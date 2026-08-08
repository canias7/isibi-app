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
// A plain module with no imports, so all of it is tested outside the Worker and
// outside the container.

/**
 * WHAT MAY BE CHANGED, and nothing else.
 *
 * Every one is a colour token the template declares at `:root`. Deliberately
 * NOT the whole shadcn palette: `--radius` is a length, the chart colours are a
 * set that has to stay distinguishable from each other, and the `-foreground`
 * halves are derived below rather than asked for — see `withContrast`.
 */
export const TOKENS = Object.freeze([
  "background", "foreground",
  "card", "popover",
  "primary", "secondary", "accent", "muted",
  "border", "input", "ring",
  "destructive",
]);

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
});

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
export const WRITABLE = Object.freeze([...TOKENS, ...new Set(Object.values(PAIRS))]);

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
const FUNC = new RegExp(
  "^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\\(\\s*" +
  "(?:" + NUM + ")(?:" + SEP + "(?:" + NUM + ")){2,3}" +
  "\\s*\\)$", "i");

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
 * same rule that refuses `red` — only the six colour functions are named.
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
 * sRGB relative luminance, from a hex or an `rgb()`.
 *
 * Only used to pick between near-black and near-white text, so a colour it
 * cannot read answers null and the caller leaves the pairing alone — a guess
 * here is worse than no change, because the wrong guess is unreadable text.
 */
export function luminance(v) {
  const s = String(v == null ? "" : v).trim();
  let r, g, b;
  if (HEX.test(s)) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
    else h = h.slice(0, 6);
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else {
    const m = /^rgba?\(\s*([-+.\d]+%?)\s*[,\s]\s*([-+.\d]+%?)\s*[,\s]\s*([-+.\d]+%?)/i.exec(s);
    if (!m) return null;
    const to255 = (t) => (t.endsWith("%") ? (parseFloat(t) / 100) * 255 : parseFloat(t));
    r = to255(m[1]); g = to255(m[2]); b = to255(m[3]);
  }
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
 * customer's own choice and is left alone, however bad. And only when the
 * luminance can actually be measured; an unreadable colour leaves the pairing
 * as it was, which is the direction that cannot make things worse.
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
export function parseTokens(input, { allow = TOKENS, max = MAX_TOKENS } = {}) {
  const out = {}, dropped = [];
  const src = input && typeof input === "object" && !Array.isArray(input) ? input
    : Array.isArray(input) ? Object.fromEntries(input
        .filter((e) => e && typeof e === "object")
        .map((e) => [String(e.token || e.name || ""), e.color || e.value])) : {};
  for (const [rawName, rawVal] of Object.entries(src)) {
    const name = String(rawName || "").trim().toLowerCase().replace(/^--/, "");
    if (!allow.includes(name)) { dropped.push(rawName); continue; }
    const val = String(rawVal == null ? "" : rawVal).trim();
    if (!isColor(val)) { dropped.push(rawName); continue; }
    if (Object.keys(out).length >= max) { dropped.push(rawName); continue; }
    out[name] = val;
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
  const keep = new Set([...Object.keys(b), ...keys].slice(0, MAX_TOKENS));
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
  const t = parseTokens(tokens, { allow: WRITABLE, max: MAX_WRITABLE }).tokens;
  const keys = Object.keys(t);
  if (!keys.length) return "";
  const decls = keys.map((k) => "  --" + k + ": " + t[k] + ";").join("\n");
  return "/* site tokens */\n:root {\n" + decls + "\n}\n.dark {\n" + decls + "\n}\n";
}

/** Plain names for the tokens a customer might have asked about. */
const SAID = Object.freeze({
  background: "background", foreground: "text colour",
  card: "cards", popover: "menus",
  primary: "buttons", secondary: "secondary buttons",
  accent: "highlights", muted: "quiet areas",
  border: "borders", input: "inputs", ring: "focus outlines",
  destructive: "delete buttons",
});

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
