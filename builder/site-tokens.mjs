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

/** Everything the designer may name, whatever kind of value it takes. */
export const ASKABLE = Object.freeze([...TOKENS, ...SIZES]);

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
export const WRITABLE = Object.freeze([...ASKABLE, ...new Set(Object.values(PAIRS))]);

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
