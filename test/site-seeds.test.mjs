// THE AUTHORED THEME — what a model may write, and what it may not.
//
// The measurement that decides whether this module can exist at all is its
// FALSE-ALARM RATE, exactly as it was for `lintPages`: a refusal here costs the
// customer their palette and falls the site back to a stock theme, so a check
// that cries wolf is strictly worse than one that misses. The corpus is the 500
// hand-written themes — re-expressed as hex seeds, as if a model had authored
// each one — and the bar is ZERO.
//
// Paired with the inverse, because a validator that refuses nothing is not a
// validator: every shape a model can get wrong has to be refused, with a reason
// that separates it from the others.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_NAME, FLOORS, SEED_MODES, SEED_ROLES, SEEDS_FIELD,
  cleanThemeName, mirrorSeeds, normalizeSeeds, paletteProblems, seedColor,
} from "../builder/site-seeds.mjs";
import { contrast, oklchToRgb, paletteFor, themeCss } from "../builder/site-theme.mjs";
import { ALL_THEMES } from "./fixtures/themes.mjs";

/* --------------------------------------------------------------- the corpus */

const hex = ([L, C, H]) => {
  const [r, g, b] = oklchToRgb(L, C, H);
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};
const asSeeds = (t, { withDark }) => ({
  name: "Corpus", paper: hex(t.light.paper), ink: hex(t.light.ink), accent: hex(t.light.accent),
  ...(withDark ? { dark: { paper: hex(t.dark.paper), ink: hex(t.dark.ink), accent: hex(t.dark.accent) } } : {}),
});

const CORPUS = Object.entries(ALL_THEMES);

test("the corpus is really there — a sweep over nothing reports a clean sweep", () => {
  // Every check below is an ABSENCE over this list, and an absence over an empty
  // list is trivially true. The floor is what stops a broken import reading as a
  // validator that refuses nothing.
  assert.ok(CORPUS.length > 400, "only " + CORPUS.length + " themes to calibrate against");
});

test("no hand-written theme is refused — with its own dark half", () => {
  const refused = CORPUS
    .map(([id, t]) => [id, normalizeSeeds(asSeeds(t, { withDark: true }))])
    .filter(([, r]) => !r.theme)
    .map(([id, r]) => id + ": " + r.why);
  assert.deepEqual(refused, [], "these hand-written palettes would be refused if a model authored them");
});

test("no hand-written theme is refused — with the dark half MIRRORED", () => {
  // The harder half, and the one that decides whether `dark` can be optional at
  // all: the mirror has to produce a legible dark mode from every light palette
  // anybody has designed here.
  const refused = CORPUS
    .map(([id, t]) => [id, normalizeSeeds(asSeeds(t, { withDark: false }))])
    .filter(([, r]) => !r.theme)
    .map(([id, r]) => id + ": " + r.why);
  assert.deepEqual(refused, [], "the mirror produces an illegible dark mode for these");
});

/* ------------------------------------------------------- what IS refused */

const GOOD = { name: "Warm Brick", paper: "#f7f2ea", ink: "#332a26", accent: "#b44a2e" };

test("a good palette is accepted, and mirrored", () => {
  const r = normalizeSeeds(GOOD);
  assert.ok(r.theme, r.why);
  assert.equal(r.theme.label, "Warm Brick");
  assert.equal(r.mirrored, true, "no dark half was given, so one must have been derived");
  assert.ok(r.theme.dark && r.theme.light, "both halves must be present or themeCss emits a .dark block of undefineds");
});

test("grey on grey is refused, and the reason names the body text", () => {
  const r = normalizeSeeds({ name: "Fog", paper: "#8a8a8a", ink: "#6f6f6f", accent: "#7a7a90" });
  assert.equal(r.theme, null);
  assert.match(r.why, /body text/);
});

test("a near-white accent is refused for being invisible AGAINST THE PAGE", () => {
  // The one no label check can see: `foregroundFor` picks the dark ink for a
  // near-white button and reports ~15:1, so every label-contrast floor passes
  // while the button is the same colour as the paper. Measured at 1.10:1.
  const r = normalizeSeeds({ name: "Ghost", paper: "#ffffff", ink: "#111111", accent: "#f7f4ee" });
  assert.equal(r.theme, null);
  assert.match(r.why, /button against the page/);
  // And the thing that makes it a real gap rather than a hypothetical: the LABEL
  // on that button is fine, so nothing else here would have caught it.
  const lit = paletteFor({ light: { paper: seedColor("#ffffff"), ink: seedColor("#111111"), accent: seedColor("#f7f4ee") },
                           dark: mirrorSeeds({ paper: seedColor("#ffffff"), ink: seedColor("#111111"), accent: seedColor("#f7f4ee") }) }, "light");
  assert.ok(contrast(lit["primary-foreground"], lit.primary) > 7, "the label really is legible — that is why this needed its own floor");
});

test("swapped modes are refused — the one failure contrast CANNOT see", () => {
  // A dark light-mode is perfectly legible, and it is still WRONG, which is why
  // this needs its own refusal — no contrast floor can see it.
  //
  // THE REASON GIVEN HERE WAS `SITE_MODE` STAMPING A CLASS, and that field was
  // deleted 2026-08-23. The refusal survives it because the two halves still
  // mean two different things: `themeCss` emits the light seeds as `:root` —
  // which IS the site — and the dark seeds as `.dark`, which is what a
  // visitor-facing theme toggle activates. So a swapped palette ships a site
  // that renders dark while its own seeds claim light, and a toggle that turns
  // it LIGHTER. Both halves land; they land the wrong way round.
  const flip = { name: "Flip", paper: "#141414", ink: "#f5f5f5", accent: "#c04a2e" };
  assert.deepEqual(paletteProblems({ label: "x", light: { paper: seedColor("#141414"), ink: seedColor("#f5f5f5"), accent: seedColor("#c04a2e") },
                                     dark: { paper: seedColor("#f5f5f5"), ink: seedColor("#141414"), accent: seedColor("#8a3520") } }),
    [], "the swapped palette passes every contrast floor — which is the point");
  const r = normalizeSeeds(flip);
  assert.equal(r.theme, null);
  assert.match(r.why, /light mode/);
});

test("a swapped DARK half is refused too", () => {
  const r = normalizeSeeds({ ...GOOD, dark: { paper: "#faf7f2", ink: "#22201e", accent: "#e08a60" } });
  assert.equal(r.theme, null);
  assert.match(r.why, /dark mode/);
});

test("half a dark half is refused, never completed", () => {
  // Filling the two roles the model named from the mirror and keeping the third
  // assembles a palette out of two different intents.
  const r = normalizeSeeds({ ...GOOD, dark: { paper: "#141210" } });
  assert.equal(r.theme, null);
  assert.match(r.why, /dark/);
});

test("nothing usable is refused with a reason that says so", () => {
  for (const raw of [null, undefined, "warm", 42, ["#fff", "#111", "#c33"]]) {
    const r = normalizeSeeds(raw);
    assert.equal(r.theme, null, "accepted " + JSON.stringify(raw));
    assert.equal(r.why, "no seeds");
  }
});

test("every refusal carries a reason", () => {
  // Four failures need four responses, and this repo has paid several times over
  // for a refusal that could only say one thing.
  for (const raw of [null, { name: "x" }, { ...GOOD, paper: "cream" },
                     { name: "Fog", paper: "#8a8a8a", ink: "#6f6f6f", accent: "#7a7a90" }]) {
    const r = normalizeSeeds(raw);
    assert.equal(r.theme, null);
    assert.ok(r.why && r.why.length > 3, "a refusal with no reason: " + JSON.stringify(raw));
  }
});

/* ------------------------------------------------------------------ colour */

test("six-digit hex only — shorthand and alpha are refused, not silently coerced", () => {
  assert.ok(seedColor("#b44a2e"), "a plain six-digit hex must parse");
  assert.ok(seedColor("B44A2E"), "the hash is optional and case does not matter");
  // The eight-digit form carries ALPHA, which the contrast maths is not defined
  // on and which `paletteFor` would silently drop — shipping a colour the model
  // did not choose.
  assert.equal(seedColor("#b44a2e80"), null);
  assert.equal(seedColor("#fff"), null);
  for (const v of ["red", "rgb(1,2,3)", "oklch(0.5 0.1 20)", "", null, 42, "#gggggg"]) {
    assert.equal(seedColor(v), null, "accepted " + JSON.stringify(v));
  }
});

test("a grey's hue is pinned, so two greys derive the same surfaces", () => {
  const [, C, H] = seedColor("#808080");
  assert.ok(C < 1e-4, "a grey must have no chroma");
  assert.equal(H, 0, "floating-point hue noise on a grey would make two identical greys derive differently");
});

/* -------------------------------------------------------------------- name */

test("the name cannot close the CSS comment it is written into", () => {
  // `themeCss` emits `/* theme: <name> — generated by … */` as the first line of
  // the stylesheet. A terminator in the name would make everything after it live
  // CSS on a published site.
  const nasty = 'x */ body{display:none} /*';
  const clean = cleanThemeName(nasty);
  assert.ok(!clean.includes("*"), "an asterisk survived: " + clean);
  assert.ok(!clean.includes("/"), "a slash survived: " + clean);
  // Driven all the way through the real emitter, because the property that
  // matters is about the STYLESHEET, not about the string.
  const css = themeCss(normalizeSeeds({ ...GOOD, name: nasty }).theme);
  const head = css.slice(0, css.indexOf("\n"));
  assert.equal(head.match(/\*\//g).length, 1, "the header comment is closed more than once: " + head);
  assert.ok(!css.includes("display:none"), "model-written text reached the stylesheet as CSS");
});

test("a name in any script survives — an ASCII allow-list mangles real businesses", () => {
  // The favicon initials shipped exactly this bug once, where `[A-Z]` gave a
  // non-Latin business an empty mark.
  for (const n of ["Café Noir", "Ελληνικό", "Тёмный лес", "日本茶", "Warm Brick"]) {
    assert.equal(cleanThemeName(n), n, "mangled " + n);
  }
});

test("a name stripped to nothing falls back rather than emitting an empty label", () => {
  for (const n of ["", "   ", "***", 42, null, undefined, {}]) {
    assert.equal(cleanThemeName(n), DEFAULT_NAME, "empty label from " + JSON.stringify(n));
  }
});

test("a long name is cut, and the cut does not leave trailing space", () => {
  const out = cleanThemeName("A".repeat(200));
  assert.ok(out.length <= 40, "not capped: " + out.length);
  assert.equal(out, out.trim());
});

/* ------------------------------------------------------------------ mirror */

test("the mirror keeps the hue and moves only the lightness", () => {
  const light = { paper: seedColor("#f7f2ea"), ink: seedColor("#332a26"), accent: seedColor("#b44a2e") };
  const d = mirrorSeeds(light);
  assert.equal(d.paper[2], light.ink[2], "dark paper must take the light ink's hue");
  assert.equal(d.ink[2], light.paper[2], "dark ink must take the light paper's hue");
  assert.equal(d.accent[2], light.accent[2], "the accent hue must not move — it is the brand");
  assert.equal(d.accent[1], light.accent[1], "the accent chroma must not move either");
  assert.ok(d.paper[0] < d.ink[0], "the mirrored dark half must be dark");
});

test("a CHROMATIC accent is lifted, not flipped", () => {
  const light = { paper: seedColor("#f7f2ea"), ink: seedColor("#332a26"), accent: seedColor("#b44a2e") };
  const d = mirrorSeeds(light);
  // A brand colour picked to sit on paper is too dark for a dark page, so it
  // lifts — but it stays recognisably the same colour rather than flipping to
  // the other end of the scale.
  assert.ok(d.accent[0] > light.accent[0], "the accent must lift for a dark page");
  assert.ok(d.accent[0] - light.accent[0] < 0.3, "a chromatic accent must not be flipped: " + d.accent[0]);
});

test("a NEUTRAL accent flips instead, because that is what every author did", () => {
  // All 11 themes in the corpus with a near-colourless accent put it on the dark
  // side in light mode and moved it 0.45-0.87 in dark. A flat lift gives a
  // near-black button on a near-black page.
  const light = { paper: seedColor("#ffffff"), ink: seedColor("#111111"), accent: seedColor("#111111") };
  const d = mirrorSeeds(light);
  assert.ok(d.accent[0] > 0.7, "a black accent must become a light one on a dark page, got L " + d.accent[0].toFixed(2));

  // CORROBORATION, NOT THE GUARANTEE — and the difference matters, because the
  // obvious way to get this wrong is to keep widening a number until it passes.
  //
  // The guarantee that a mirrored dark mode is USABLE is the 500-theme sweep
  // above: it is about legibility and it is absolute. What this adds is evidence
  // that the rule is principled rather than tuned — eleven people, independently,
  // landed within 0.093 of where it lands, median 0.04, one of them exactly on
  // it. A derivation that agrees with every human who ever answered the same
  // question is a derivation and not a fudge.
  //
  // 0.12 is that measured worst case plus a little air, so a future theme whose
  // author was a shade more extreme does not fail a test about taste.
  const neutral = CORPUS.filter(([, t]) => t.light.accent[1] < 0.02);
  assert.ok(neutral.length >= 8, "only " + neutral.length + " neutral-accent themes — the check below proves little");
  for (const [id, t] of neutral) {
    const got = mirrorSeeds(t.light).accent[0];
    assert.ok(Math.abs(got - t.dark.accent[0]) < 0.12,
      id + ": mirror gave L " + got.toFixed(2) + ", the author wrote " + t.dark.accent[0].toFixed(2));
  }
  // And it must be CLOSE for most of them, or "within 0.12" is satisfied by a
  // rule that happens to land in the right half of the scale.
  const close = neutral.filter(([, t]) => Math.abs(mirrorSeeds(t.light).accent[0] - t.dark.accent[0]) < 0.05);
  assert.ok(close.length >= neutral.length / 2,
    "only " + close.length + " of " + neutral.length + " are within 0.05 — the rule is landing in the area, not on the answer");
});

test("the neutral rule does not swallow an ordinary coloured accent", () => {
  // The boundary matters in one direction only: treating a real brand colour as
  // neutral would flip it to the wrong end of the scale.
  const chromatic = CORPUS.filter(([, t]) => t.light.accent[1] >= 0.05);
  assert.ok(chromatic.length > 300, "only " + chromatic.length + " chromatic themes");
  for (const [id, t] of chromatic) {
    const got = mirrorSeeds(t.light).accent[0];
    assert.ok(Math.abs(got - (t.light.accent[0] + 0.17)) < 1e-9 || got === 1 || got === 0,
      id + ": a coloured accent took the neutral path");
  }
});

/* ------------------------------------------------------------------ floors */

test("no floor's name is a prefix of another's", () => {
  // Found by mutation: `"quiet text"` and `"quiet text on the page"` meant one
  // of the two floors was covered by nothing, because the derived check below
  // was satisfied by the other one's message. It is also a reporting bug in its
  // own right — two floors sharing a name give the customer two sentences they
  // cannot tell apart.
  for (const a of FLOORS) {
    for (const b of FLOORS) {
      if (a === b) continue;
      assert.ok(!b.what.startsWith(a.what),
        '"' + a.what + '" is a prefix of "' + b.what + '" — one of them can never be reported distinctly');
    }
  }
});

test("the floors are what paletteProblems really checks — derived, not restated", () => {
  // A second list of "which pairs matter" is a second thing to keep in step, and
  // the direction it drifts in is a check that passes a palette the site then
  // renders illegibly. So each declared floor is DRIVEN: collapse the palette
  // onto one colour, which fails every pair at once, then require THIS floor's
  // own message to be among the complaints.
  const { theme } = normalizeSeeds(GOOD);
  assert.ok(theme);
  assert.deepEqual(paletteProblems(theme), [], "the reference palette must be clean");
  const flat = { ...theme, light: { paper: seedColor("#808080"), ink: seedColor("#858585"), accent: seedColor("#828282") } };
  const said = paletteProblems(flat);
  for (const f of FLOORS) {
    // Anchored on the message's own shape (`<what> in <mode> mode is …`) rather
    // than on the bare name, so a floor whose name merely CONTAINS another's
    // cannot answer for it. The prefix test above is what keeps that honest.
    assert.ok(said.some((m) => m.startsWith(f.what + " in ")),
      "no floor reported for " + f.what + " — got: " + said.join(" | "));
  }
  assert.ok(said.length >= FLOORS.length, "a collapsed palette must fail every floor, got " + said.length);
});

test("a palette that cannot be derived at all is reported, not thrown", () => {
  const said = paletteProblems({ label: "x", light: null, dark: null });
  assert.equal(said.length, SEED_MODES.length, "both modes must be reported: " + said.join(" | "));
});

/* ------------------------------------------------------------------ prompt */

test("the field asks for three colours and a name, and dark is optional", () => {
  // The optionality is the whole reason the mirror was measured. A `dark` in
  // `required` costs tokens on every build and invites a model to write a dark
  // palette worse than the derived one.
  assert.deepEqual(SEEDS_FIELD.required, ["name", ...SEED_ROLES]);
  assert.ok(!SEEDS_FIELD.required.includes("dark"), "dark must stay optional");
  for (const role of SEED_ROLES) assert.ok(SEEDS_FIELD.properties[role], "no field for " + role);
  assert.deepEqual(SEEDS_FIELD.properties.dark.required, [...SEED_ROLES],
    "a dark half that IS given must be complete — a partial one is refused, not completed");
});

test("the order of the fields is the instruction, and `name` comes first", () => {
  // A tool schema's property order is the order the model fills the fields in.
  // Committing to what the site FEELS like before picking a colour is the order
  // a person works in; reversing it produces three colours chosen one at a time.
  const keys = Object.keys(SEEDS_FIELD.properties);
  assert.equal(keys[0], "name");
  assert.equal(keys.at(-1), "dark", "the optional half must be last");
  assert.deepEqual(keys.slice(1, 4), [...SEED_ROLES]);
});

test("the description tells the model NOT to write the derived tokens", () => {
  // The failure this prevents is a model reaching for the 31 tokens it can see
  // in the template. Every one it wrote by hand would bypass a legibility
  // derivation — `foregroundFor`, `fitState`, `separateFromAccent`.
  assert.match(SEEDS_FIELD.description, /worked out from them|do not try to name/i);
  assert.match(SEEDS_FIELD.properties.dark.description, /optional/i);
});

/* ------------------------------------------------------------------ output */

test("an authored theme produces a complete stylesheet, both modes", () => {
  // The end-to-end property: seeds in, a stylesheet out with BOTH blocks. A
  // theme missing `dark` emits a `.dark` block of undefineds, which the browser
  // drops silently and which reads on screen as dark mode never having been
  // themed.
  const css = themeCss(normalizeSeeds(GOOD).theme);
  assert.ok(css && css.includes(":root {"), "no :root block");
  assert.ok(css.includes(".dark {"), "no .dark block");
  assert.ok(css.includes("Warm Brick"), "the palette's name must reach the stylesheet header");
  const tokens = (css.match(/--[a-z-]+:/g) || []).length;
  assert.ok(tokens > 60, "only " + tokens + " token declarations — the derivation did not run");
  // The two blocks must DIFFER, or the site renders identically in both modes
  // and the whole dark half was wasted.
  const root = css.slice(css.indexOf(":root {"), css.indexOf(".dark {"));
  const dark = css.slice(css.indexOf(".dark {"), css.indexOf("}", css.indexOf(".dark {")));
  assert.notEqual(root.replace(":root", ""), dark.replace(".dark", ""));
});
