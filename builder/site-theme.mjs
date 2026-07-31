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
  ledger: {
    label: "Ledger — warm paper, oxblood, tight corners",
    radius: "0.25rem",
    corner: "round",
    light: { paper: [0.985, 0.006, 95], ink: [0.22, 0.014, 60], accent: [0.46, 0.14, 28] },
    dark: { paper: [0.19, 0.012, 60], ink: [0.96, 0.005, 95], accent: [0.63, 0.13, 30] },
  },
  // Deliberately opposite to Ledger on all four levers — cool paper against warm,
  // a calm green against oxblood, and 16px corners against 4px. Two themes that
  // differ on only one lever prove nothing about whether the system produces
  // range.
  //
  // It is ALSO the awkward case on purpose: the accent sits at hue 165 and
  // `success` at 156, nine degrees apart. That is well inside the same lane, so
  // the separation rule has to move the success colour or a confirmation on this
  // site would be drawn in the brand colour and stop reading as a confirmation.
  // A theme nobody would have thought to test is worth more in the set than a
  // second safe one.
  atrium: {
    label: "Atrium — cool light, calm green, soft corners",
    radius: "1rem",
    corner: "round",
    light: { paper: [0.985, 0.004, 230], ink: [0.21, 0.012, 240], accent: [0.48, 0.09, 165] },
    dark: { paper: [0.18, 0.012, 240], ink: [0.96, 0.004, 230], accent: [0.68, 0.1, 168] },
  },

  /* ── the considered end ──────────────────────────────────────────────────
   *
   * Four themes for trades where the site is part of what is being sold. They
   * share three moves, and each one is a deliberate step away from the look
   * generated design falls into:
   *
   *   THE PAPER IS NOT NEAR-WHITE. Every one sits between L 0.92 and L 0.95 —
   *   bone, oyster, stone. An off-white ground is the single clearest tell of a
   *   template, because it is what you get by not deciding. A ground with a
   *   value reads as a choice before a single word is read.
   *
   *   THE RADIUS IS AT AN END, NEVER THE MIDDLE. 0px or 2-3px. Around 10px is
   *   shadcn's default and every SaaS product on earth, which is exactly why it
   *   reads as unconsidered.
   *
   *   THE ACCENT IS DARKER AND LESS SATURATED THAN INSTINCT SUGGESTS. Chroma
   *   0.06-0.11 against Ledger's 0.14. Restraint is most of what reads as
   *   expensive; a bright accent reads as a startup.
   *
   * And the clichés are avoided by name: no warm cream with terracotta, no
   * near-black with a lone acid-green pop, no purple-to-blue.
   *
   * A FOURTH MOVE, FOUND BY LOOKING AT THE DARK RENDERS. The obvious way to keep
   * an accent legible on a dark ground is to lighten it past the paper, and it
   * measures fine — `foregroundFor` simply flips to the dark text and every
   * contrast check passes. It also destroys the theme: Vellum's deep plum came
   * out a candy pink, Bourse's indigo a periwinkle, and a pastel fill with dark
   * text on near-black is the exact purple-on-white look these themes exist to
   * avoid. So these three stay DEEP in dark mode (L 0.44-0.48) and take LIGHT
   * text instead — the button is a saturated block of the brand rather than a
   * glowing chip, which is how the register survives the mode switch.
   *
   * Atelier is the deliberate exception and inverts instead: on a monochrome
   * theme the near-white button on near-black IS the statement.
   */

  // Private bank, tailoring, chambers. High contrast, cold accent, almost no
  // radius — the palette equivalent of a good suit: nothing decorative, and the
  // quality is entirely in the cut.
  bourse: {
    label: "Bourse — bone paper, deep indigo, near-square corners",
    radius: "0.125rem",
    corner: "round",
    light: { paper: [0.932, 0.008, 88], ink: [0.175, 0.018, 262], accent: [0.34, 0.075, 264] },
    dark: { paper: [0.165, 0.016, 262], ink: [0.94, 0.006, 88], accent: [0.44, 0.115, 264] },
  },

  // Gallery, perfumery, jeweller. Square corners and a plum that is nearly
  // brown — the accent should be noticed on the second look, not the first.
  vellum: {
    label: "Vellum — oyster paper, deep plum, moulded corners",
    radius: "0.75rem",
    corner: "squircle",
    light: { paper: [0.945, 0.007, 72], ink: [0.168, 0.014, 35], accent: [0.375, 0.095, 338] },
    dark: { paper: [0.155, 0.012, 35], ink: [0.945, 0.006, 72], accent: [0.42, 0.11, 335] },
  },

  // Apothecary, winery, heritage food. Ink is a very dark green rather than
  // black, which is the whole trick: the page reads warm and old without a
  // single brown surface.
  //
  // Its accent lands at hue 80, two degrees from `warning` at 78 — deep inside
  // the same lane, so the separation rule has to move the warning colour or a
  // caution on this site is drawn in the brand colour.
  coppice: {
    label: "Coppice — warm stone, brass, cut corners",
    radius: "0.4375rem",
    corner: "bevel",
    light: { paper: [0.928, 0.013, 92], ink: [0.198, 0.028, 152], accent: [0.505, 0.088, 80] },
    dark: { paper: [0.172, 0.022, 152], ink: [0.938, 0.01, 92], accent: [0.48, 0.092, 80] },
  },

  // Fashion, design studio, photographer. NEARLY MONOCHROME ON PURPOSE: the
  // accent is a warm near-black, so emphasis comes from weight and contrast
  // rather than from hue. This is the hardest register to fake and the one most
  // opposite to generated design, which reaches for a colour to prove it made a
  // decision.
  atelier: {
    label: "Atelier — chalk paper, near-black accent, square corners",
    radius: "0rem",
    corner: "round",
    light: { paper: [0.955, 0.003, 96], ink: [0.145, 0.005, 92], accent: [0.245, 0.012, 88] },
    dark: { paper: [0.135, 0.005, 92], ink: [0.955, 0.003, 96], accent: [0.86, 0.008, 94] },
  },
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
 */
export function themeCss(name) {
  const theme = THEMES[name];
  if (!theme) return null;
  const block = (sel, mode) => {
    const p = paletteFor(theme, mode);
    const lines = Object.entries(p).map(([k, v]) => `  --${k}: ${css(v)};`);
    return `${sel} {\n${lines.join("\n")}\n}`;
  };
  // The corner block is separate from the palette blocks because it is not a
  // colour and, for two of the three treatments, not a single declaration
  // either — `elliptical` writes four scale steps and `bevel` adds a selector.
  return `/* theme: ${name} — generated by builder/site-theme.mjs */\n` +
    block(":root", "light") + "\n\n" + block(".dark", "dark") + "\n\n" + cornerCss(theme);
}

/** What the model may choose from — an enum, so an invalid theme is impossible. */
export const THEME_NAMES = Object.keys(THEMES);
export function shortlistForPrompt() {
  return Object.entries(THEMES).map(([k, v]) => `${k} — ${v.label}`).join("\n");
}
