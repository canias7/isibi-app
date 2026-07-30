// Which typeface a generated site is set in.
//
// Every site the builder has ever made renders in whatever font the visitor's
// machine defaults to — Helvetica on a Mac, Segoe on Windows — because the
// template has no `--font-sans` and no `--font-heading` at all. That is most of
// why a generated site can look unfinished next to a hand-made one.
//
// Two decisions shape this file, and both were made against measurements:
//
// 1. THE MODEL PICKS FROM A SHORTLIST, NOT FROM EVERYTHING. Fontsource publishes
//    2,096 families. Listing them for the model costs ~7,500 tokens on EVERY
//    generation (~$0.022 a build, forever) and buries the brief under font names.
//    The shortlist is ~74 tokens and is declared as a tool ENUM, so an invalid
//    font is impossible rather than something a lint has to catch afterwards.
//
// 2. THE OTHER 2,072 ARE STILL REACHABLE, BY FETCH RATHER THAN BY INSTALL.
//    Installing all of them adds 2.48 GB to the build container image (sampled:
//    median 0.24 MB, mean 1.18 MB per package), which `npm ci` rebuilds on every
//    deploy. Fetching the one file a site actually asked for takes 0.5-1.2s,
//    measured, and the file is SMALLER than the package: an npm font ships every
//    alphabet and weight, and a fetch takes the latin subset at the weight used.
//    Bebas Neue is 13,768 bytes fetched.
//
// Pure logic, no I/O — the caller does the fetching, the way site-data.mjs takes
// its database functions. So all of this is tested outside the Worker.

import FONT_INDEX from "./font-index.json" with { type: "json" };

/**
 * What the model may choose from.
 *
 * Chosen to span what a small business actually asks for rather than to be a
 * survey: a neutral workhorse, a geometric, a humanist, a grotesque with some
 * character, four serifs of different temperature, a slab, and two monos. Every
 * one is a variable font, so weight is free.
 *
 * `label` is what the model sees; `pkg` is what is installed. Both halves are
 * asserted against package.json by a test — a name here that is not installed
 * produces a site whose CSS points at a font that was never bundled, which
 * renders as the fallback and looks like nothing happened.
 */
export const SHORTLIST = [
  { id: "geist", pkg: "@fontsource-variable/geist", family: "Geist Variable", kind: "sans", feel: "neutral, modern, gets out of the way" },
  { id: "inter", pkg: "@fontsource-variable/inter", family: "Inter Variable", kind: "sans", feel: "neutral, ubiquitous, very legible small" },
  { id: "dm-sans", pkg: "@fontsource-variable/dm-sans", family: "DM Sans Variable", kind: "sans", feel: "geometric, friendly, a little soft" },
  { id: "figtree", pkg: "@fontsource-variable/figtree", family: "Figtree Variable", kind: "sans", feel: "rounded, warm, approachable" },
  { id: "manrope", pkg: "@fontsource-variable/manrope", family: "Manrope Variable", kind: "sans", feel: "geometric, slightly technical" },
  { id: "outfit", pkg: "@fontsource-variable/outfit", family: "Outfit Variable", kind: "sans", feel: "geometric, confident, good big" },
  { id: "space-grotesk", pkg: "@fontsource-variable/space-grotesk", family: "Space Grotesk Variable", kind: "sans", feel: "grotesque with character, a bit editorial" },
  { id: "instrument-sans", pkg: "@fontsource-variable/instrument-sans", family: "Instrument Sans Variable", kind: "sans", feel: "tight, contemporary, quietly stylish" },
  { id: "public-sans", pkg: "@fontsource-variable/public-sans", family: "Public Sans Variable", kind: "sans", feel: "plain, institutional, trustworthy" },
  { id: "source-sans-3", pkg: "@fontsource-variable/source-sans-3", family: "Source Sans 3 Variable", kind: "sans", feel: "humanist, calm, reads long" },
  { id: "ibm-plex-sans", pkg: "@fontsource-variable/ibm-plex-sans", family: "IBM Plex Sans Variable", kind: "sans", feel: "engineered, slightly cool" },
  { id: "nunito-sans", pkg: "@fontsource-variable/nunito-sans", family: "Nunito Sans Variable", kind: "sans", feel: "soft, rounded, gentle" },
  { id: "montserrat", pkg: "@fontsource-variable/montserrat", family: "Montserrat Variable", kind: "sans", feel: "wide geometric, familiar, urban" },
  { id: "raleway", pkg: "@fontsource-variable/raleway", family: "Raleway Variable", kind: "sans", feel: "elegant, thin, boutique" },
  { id: "oxanium", pkg: "@fontsource-variable/oxanium", family: "Oxanium Variable", kind: "sans", feel: "squared, sporty, technical" },
  { id: "playfair-display", pkg: "@fontsource-variable/playfair-display", family: "Playfair Display Variable", kind: "serif", feel: "high-contrast, dramatic, luxury" },
  { id: "eb-garamond", pkg: "@fontsource-variable/eb-garamond", family: "EB Garamond Variable", kind: "serif", feel: "classical, bookish, understated" },
  { id: "lora", pkg: "@fontsource-variable/lora", family: "Lora Variable", kind: "serif", feel: "contemporary serif, warm, readable" },
  { id: "merriweather", pkg: "@fontsource-variable/merriweather", family: "Merriweather Variable", kind: "serif", feel: "sturdy, dependable, easy at small sizes" },
  { id: "noto-serif", pkg: "@fontsource-variable/noto-serif", family: "Noto Serif Variable", kind: "serif", feel: "neutral serif, wide language coverage" },
  { id: "instrument-serif", pkg: "@fontsource/instrument-serif", family: "Instrument Serif", kind: "serif", feel: "editorial display, striking in a headline" },
  { id: "roboto-slab", pkg: "@fontsource-variable/roboto-slab", family: "Roboto Slab Variable", kind: "slab", feel: "slab, solid, a bit industrial" },
  { id: "jetbrains-mono", pkg: "@fontsource-variable/jetbrains-mono", family: "JetBrains Mono Variable", kind: "mono", feel: "monospace, technical" },
  { id: "geist-mono", pkg: "@fontsource-variable/geist-mono", family: "Geist Mono Variable", kind: "mono", feel: "monospace, modern, clean" },
];

const BY_ID = new Map(SHORTLIST.map((f) => [f.id, f]));

/**
 * The default pairing.
 *
 * A site that names nothing still has to render, and it must NOT fall back to
 * the browser default — that is the state this whole file exists to end. Geist
 * over Geist because a single neutral grotesque is the choice least likely to
 * fight whatever brand a generated site turns out to have.
 */
export const DEFAULT_FONTS = { heading: "geist", body: "geist" };

/**
 * The system stack, kept as the LAST resort inside the CSS variable itself.
 *
 * One per KIND, because a single sans stack is wrong for the two thirds of the
 * shortlist that are not sans: if Lora fails to load, a serif design falls back
 * to Helvetica and stops being a serif design. The fallback should look like
 * what it is standing in for.
 */
export const SYSTEM_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const SYSTEM_STACKS = {
  sans: SYSTEM_STACK,
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  slab: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};
export const stackFor = (kind) => SYSTEM_STACKS[kind] || SYSTEM_STACK;

/**
 * A name as somebody would type it, turned into a Fontsource id.
 *
 * Done LOCALLY against the 2,096-name index (31 KB) rather than by asking the
 * API, for a reason that is not performance: the API is strict, and measured,
 * `Playfair Display` is a 404 while `playfair-display` is a 200. Passing a
 * person's typing straight through would 404 on the correct answer. Matching
 * here also means `Helvetica` — which is not on Google Fonts and never will be —
 * is refused instantly and offline, with something useful to say, instead of
 * costing a request that fails.
 */
export function normalizeFontName(input) {
  return String(input == null ? "" : input)
    .trim().toLowerCase()
    .replace(/\bvariable\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Levenshtein, bounded — only used against a shortlist of candidates. */
function distance(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The closest real font to what somebody typed, or null.
 *
 * Exact first, then prefix, then edit distance — and the distance is bounded
 * relative to the length of the query, because an unbounded "nearest" always
 * returns something and would answer `Helvetica` with whatever happens to be
 * least far away. Saying "not available" is the useful answer there.
 */
export function nearestFontName(input) {
  const q = normalizeFontName(input);
  if (!q) return { id: null, d: Infinity };
  let best = null, bestD = Infinity;
  for (const n of FONT_INDEX) {
    if (Math.abs(n.length - q.length) > 6) continue;
    const dd = distance(q, n);
    if (dd < bestD) { best = n; bestD = dd; }
  }
  return { id: best, d: bestD };
}

export function matchFontName(input) {
  const q = normalizeFontName(input);
  if (!q) return null;
  if (FONT_INDEX.includes(q)) return q;

  // DISTANCE BEFORE PREFIX, and the order is the whole correctness of this
  // function. Prefix-first answered "playfair dsiplay" with `playfair` — a real,
  // DIFFERENT family — because the typo'd second word made the query look like
  // "playfair + something". Silently substituting another font is worse than
  // refusing: nobody reviews a font they did not ask for. Edit distance puts it
  // 2 away from `playfair-display` and gets it right.
  // Distance is only trusted on a query long enough for a near miss to mean a
  // typo. Below that it means a different word: `noto` is ONE edit from `doto`,
  // a real and unrelated family, so a short query would substitute rather than
  // correct — the same failure the ordering above fixes, one size down.
  if (q.length >= 6) {
    const limit = Math.max(1, Math.min(3, Math.floor(q.length / 4)));
    const near = nearestFontName(q);
    if (near.id && near.d <= limit) return near.id;
  }

  // Prefix handles the honest short form: "noto" -> noto-sans, "ibm plex" ->
  // ibm-plex-sans, neither of which distance can reach. Shortest completion
  // first, then INSTALLED wins the tie — "ibm-plex-mono" and "ibm-plex-sans" are
  // the same length, and answering a bare "ibm plex" with the monospace one is
  // the wrong guess for a body font.
  const starts = FONT_INDEX.filter((n) => n.startsWith(q + "-") || q.startsWith(n + "-"));
  if (starts.length) {
    starts.sort((a, b) => a.length - b.length || (BY_ID.has(b) - BY_ID.has(a)) || a.localeCompare(b));
    return starts[0];
  }
  return null;
}

/**
 * Where a font comes from: already installed, fetchable, or nowhere.
 *
 * `installed` is the fast path and covers everything the model can choose.
 * `fetch` is the override path — the caller downloads `url` and hands the bytes
 * to the build. `unknown` carries `suggestion` when there is a near miss, so the
 * answer to "use Helvetica" can be a sentence rather than a failure.
 */
export function resolveFont(input) {
  const raw = normalizeFontName(input);
  if (BY_ID.has(raw)) {
    const f = BY_ID.get(raw);
    return { ok: true, source: "installed", id: f.id, family: f.family, pkg: f.pkg, kind: f.kind };
  }
  const id = matchFontName(input);
  if (!id) {
    // A suggestion is offered on a LOOSER threshold than a match, deliberately.
    // Acting on a guess and proposing one are different risks: substituting a
    // font nobody asked for is silent and wrong, while "did you mean X?" is
    // read by a person who can say no. Helvetica still has no near miss and is
    // simply reported as unavailable.
    const near = nearestFontName(raw);
    const loose = Math.max(2, Math.min(5, Math.floor(raw.length / 3)));
    return { ok: false, source: "unknown", id: raw, suggestion: near.d <= loose ? near.id : null };
  }
  if (BY_ID.has(id)) {
    const f = BY_ID.get(id);
    return { ok: true, source: "installed", id: f.id, family: f.family, pkg: f.pkg, kind: f.kind };
  }
  return {
    ok: true, source: "fetch", id,
    family: id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    // A fetched font's kind is not known without asking the API, and the caller
    // fills it in from the response. Until then `sans` is the safe assumption:
    // it is what two thirds of the catalogue is.
    kind: "sans",
    url: `https://api.fontsource.org/v1/fonts/${encodeURIComponent(id)}`,
  };
}

/**
 * A requested pairing, resolved and always usable.
 *
 * Never fails: an unknown name falls back to the default rather than failing the
 * build, because a site in the wrong typeface is a far smaller problem than a
 * site that did not publish. What was asked for and what was used are both
 * returned, so the caller can say so.
 */
export function resolvePair(req) {
  const out = { heading: null, body: null, notes: [] };
  for (const slot of ["heading", "body"]) {
    const asked = req && req[slot];
    const r = asked ? resolveFont(asked) : { ok: false, source: "unset" };
    if (r.ok) { out[slot] = r; continue; }
    if (asked) {
      out.notes.push(
        `"${asked}" isn't a font we can get` +
        (r.suggestion ? ` — did you mean ${r.suggestion}?` : "") + ". Used the default instead.",
      );
    }
    out[slot] = resolveFont(DEFAULT_FONTS[slot]);
  }
  return out;
}

/**
 * The CSS a site needs, given a resolved pair.
 *
 * The system stack stays at the END of both variables. A font file that fails to
 * load leaves text rendered rather than invisible, and a site built before any
 * of this existed keeps working unchanged.
 *
 * `@font-face` is emitted only for a FETCHED font — an installed one brings its
 * own via the package's CSS, and declaring it twice would have the browser load
 * both copies.
 */
export function fontCss(pair, fetched = {}) {
  const faces = [];
  for (const slot of ["heading", "body"]) {
    const f = pair[slot];
    if (!f || f.source !== "fetch") continue;
    const file = fetched[f.id];
    if (!file) continue;
    faces.push(
      `@font-face{font-family:"${f.family}";src:url("${file}") format("woff2");` +
      `font-weight:100 900;font-style:normal;font-display:swap;}`,
    );
  }
  const stack = (f) => `"${f.family}", ${stackFor(f.kind)}`;
  return {
    // Declarations only, for the caller to place INSIDE Tailwind's @theme block.
    // Returned separately from the @font-face rules because the two belong in
    // different places: @theme cannot contain an at-rule, and a `:root` block of
    // our own is dropped by the minifier as dead once Tailwind's own `:root`
    // lands after it — measured, and it shipped the default font while reporting
    // the chosen one.
    vars: [
      `  --font-sans: ${stack(pair.body)};`,
      `  --font-heading: ${stack(pair.heading)};`,
    ].join("\n"),
    faces: faces.join("\n"),
  };
}

/** The npm side-effect imports for whichever of the pair are installed. */
export function fontImports(pair) {
  const pkgs = [];
  for (const slot of ["heading", "body"]) {
    const f = pair[slot];
    if (f && f.source === "installed" && !pkgs.includes(f.pkg)) pkgs.push(f.pkg);
  }
  return pkgs;
}

/** What the model is shown. Kept short on purpose — this rides on every build. */
export function shortlistForPrompt() {
  return SHORTLIST.map((f) => `${f.id} (${f.kind}, ${f.feel})`).join("\n");
}
