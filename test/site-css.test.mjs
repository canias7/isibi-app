// The authored-CSS validator.
//
// TWO MISTAKES, AND THEY ARE NOT SYMMETRIC:
//
//   LET SOMETHING THROUGH — a value reaches a customer's published stylesheet
//   that closes its own declaration, fetches a remote host, or paints a wash
//   whose stops we cannot read and therefore whose text contrast we cannot
//   guarantee. That last one is the quiet version and it is the reason the
//   parser exists at all.
//
//   REFUSE SOMETHING CORRECT — the model writes an ordinary gradient and is told
//   off. This repo rates that WORSE than the miss, because it teaches the model
//   away from a thing that works, and the first run of this file did exactly
//   that to three of four perfectly plain gradients (hex digits and units read
//   as bare keywords). So the accepted-cases block below is not decoration: it
//   is the half that was wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readLayer, readAuthored, readColors, resolveVars, extremes, MAX_LAYER, MAX_LAYERS } from "../builder/site-css.mjs";

// --------------------------------------------------------- it must ACCEPT

const REAL = [
  "linear-gradient(#fce7c8, #ffffff)",
  "radial-gradient(at 20% 0%, oklch(0.9 0.08 60) 0%, transparent 60%)",
  "conic-gradient(from 90deg at 50% 50%, #eee, #fff, #eee)",
  "repeating-linear-gradient(45deg, #f5f5f5 0 10px, #ffffff 10px 20px)",
  "linear-gradient(180deg, rgb(250 245 235) 0%, hsl(30 40% 96%) 100%)",
  "radial-gradient(ellipse 80% 50% at 50% -20%, oklch(0.85 0.12 30 / 40%), transparent)",
  "linear-gradient(to top, lab(90 4 12), lch(95 6 80))",
];

test("an ordinary gradient is accepted, in every notation the platform writes", () => {
  for (const g of REAL) {
    const r = readLayer(g);
    assert.equal(r.ok, true, g + " was refused: " + r.why);
    assert.ok(r.colors.length >= 1, g + " yielded no readable stop");
  }
});

test("a hex colour's DIGITS are not read as a keyword", () => {
  // The false alarm that killed three of four real gradients on the first run:
  // `#` is not part of a word match, so `fce7c8` looked like a misspelling.
  assert.equal(readLayer("linear-gradient(#fce7c8, #ffffff)").ok, true);
  assert.equal(readLayer("linear-gradient(#abc, #def)").ok, true);
});

test("a unit is not read as a keyword, but a MISSPELLED one still is", () => {
  // Stripping dimensions is what makes every angled gradient work; the second
  // half is why they are stripped rather than added to the keyword list — a
  // bare `deg` where a colour belongs must still be refused.
  assert.equal(readLayer("linear-gradient(90deg, #fff, #000)").ok, true);
  assert.equal(readLayer("linear-gradient(2.5turn, #fff, #000)").ok, true);
  assert.equal(readLayer("linear-gradient(90dge, #fff, #000)").ok, false);
  assert.match(readLayer("linear-gradient(90dge, #fff, #000)").why, /dge/);
});

// --------------------------------------------------------- it must REFUSE

test("the injection shapes are refused by CHARACTER, not by escaping", () => {
  // There is no correct escape for arbitrary text in a CSS value, so the shapes
  // that would need one are simply not accepted — the rule `isColor` and
  // `routeSelectorOk` already live under.
  for (const bad of [
    "linear-gradient(#fff,#000)} body{display:none} .x{",
    "linear-gradient(#fff,#000); background: #f00",
    "@import url(https://evil.example/x.css)",
    "linear-gradient(#fff,#000)\\3b  background:#f00",
    'linear-gradient(#fff,#000) "quoted"',
  ]) {
    assert.equal(readLayer(bad).ok, false, "LEAKED: " + bad);
  }
});

test("url() is refused outright — it is a fetch, not a colour", () => {
  // A remote host the CSP would refuse anyway (so the layer silently does not
  // paint), or a data: URI, which is arbitrary bytes on a customer's site
  // arriving through a field that describes a colour ramp.
  assert.match(readLayer("url(https://x.example/a.png)").why, /url\(\)/);
  assert.match(readLayer("url(data:image/svg+xml,PHN2Zz48L3N2Zz4=)").why, /url\(\)|never needs/);
});

test("an unknown function is refused, never passed through", () => {
  // An allow-list, the `modelsFor` rule: this arrives in a model's answer and
  // reaches a stylesheet, so an unknown name is a value to refuse rather than a
  // function to hope about.
  assert.match(readLayer("image-set(#fff 1x)").why, /image-set|never needs/);
  assert.match(readLayer("paint(myWorklet)").why, /paint/);
  assert.match(readLayer("element(#hero)").why, /element/);
});

test("a comment is refused — it hides the rest of the value from a reader", () => {
  assert.match(readLayer("linear-gradient(/* x */ #fff, #000)").why, /comment/);
  assert.match(readLayer("linear-gradient(#fff, #000) */").why, /comment/);
});

test("unbalanced brackets are refused — the value would run into the next rule", () => {
  assert.match(readLayer("linear-gradient(#fff, #000").why, /bracket/);
  assert.match(readLayer("linear-gradient(#fff, #000))").why, /bracket/);
});

test("a layer with NO readable colour is refused", () => {
  // Two reasons, and the first is the load-bearing one: a stop we cannot read is
  // a contrast floor we cannot prove. The second is that a layer of pure
  // transparent paints nothing, which reads to the customer as their backdrop
  // having been ignored.
  assert.match(readLayer("linear-gradient(transparent, transparent)").why, /colour we could read/);
});

test("an oversized value is refused", () => {
  const huge = "linear-gradient(" + Array.from({ length: 200 }, (_, i) => `#ff${String(i % 100).padStart(2, "0")}00`).join(", ") + ")";
  assert.ok(huge.length > MAX_LAYER);
  assert.match(readLayer(huge).why, /longer than/);
});

test("junk of every shape is refused rather than coerced", () => {
  for (const junk of [null, undefined, "", "   ", 42, [], {}, true]) {
    assert.equal(readLayer(junk).ok, false, JSON.stringify(junk) + " was accepted");
  }
});

// --------------------------------------------------------- var() resolution

test("var() is RESOLVED against the theme, so the stop stays readable", () => {
  // A backdrop tinted with the site's own accent is the most useful thing an
  // authored one can do, and the first thing a model reaches for. Refusing
  // var() outright would make every authored wash unrelated to the brand.
  const r = readLayer("linear-gradient(var(--accent), #ffffff)", { vars: { "--accent": "#c8442e" } });
  assert.equal(r.ok, true, r.why);
  assert.match(r.value, /#c8442e/, "the token was not substituted");
  assert.equal(r.colors.length, 2, "the resolved stop is not readable");
});

test("an UNRESOLVABLE var() is refused — not because it is dangerous, but because the floor could not be proved", () => {
  assert.match(readLayer("linear-gradient(var(--nope), #fff)").why, /does not define/);
});

test("resolveVars cannot spin on a cycle", () => {
  const out = resolveVars("var(--a)", { "--a": "var(--b)", "--b": "var(--a)" });
  assert.equal(typeof out, "string");
});

// --------------------------------------------------------- the colour read

test("the stops are read through site-tokens' OWN parser, in every notation", () => {
  // Two readings of "what colour is this" is how a contrast floor ends up
  // computed against a colour that is not the one on screen — a bug that file
  // has already shipped once, where isColor accepted six notations luminance
  // could not read.
  const c = readColors("linear-gradient(#ffffff, oklch(0.2 0 0), rgb(10 20 30), hsl(200 50% 40%))");
  assert.equal(c.length, 4, "a notation was missed: " + JSON.stringify(c.map((x) => x.token)));
  for (const x of c) assert.ok(Number.isFinite(x.luminance), x.token + " has no luminance");
});

test("a function-shaped colour is taken WHOLE, not split on its commas", () => {
  // The depth-aware read this repo has written wrong four times: a flat split
  // cuts rgb(10, 20, 30) into three fragments and reads none of them.
  const c = readColors("linear-gradient(rgb(10, 20, 30), hsl(200, 50%, 40%))");
  assert.equal(c.length, 2, "a comma inside a colour function split it: " + JSON.stringify(c.map((x) => x.token)));
  assert.ok(c.every((x) => Number.isFinite(x.luminance)));
});

test("color-mix is REFUSED, because its endpoints are not a safe stand-in for it", () => {
  // MEASURED, not assumed. `isColor("color-mix(…)")` is false, so only the
  // endpoints would be read — and over 40,000 random pairs interpolated in
  // oklch, 9.08% of mixes land OUTSIDE their endpoints' luminance range, worst
  // by 0.212. So the endpoint range UNDER-estimates the ground, which is the
  // direction that drops the contrast floor.
  //
  // It was in the allow-list until this was measured, which is the point of
  // measuring: the intuition that a mix sits between its endpoints is wrong.
  const r = readLayer("linear-gradient(color-mix(in oklch, #ffffff 40%, #000000), #888888)");
  assert.equal(r.ok, false, "color-mix was accepted — its mixed colour is unreadable");
  assert.match(r.why, /color-mix/);
});

test("extremes answers NULL rather than a default range when nothing was readable", () => {
  // "No colours" read as "0 to 1" would silently drop the contrast floor to the
  // widest possible ground — the direction that hides the failure.
  assert.equal(extremes([]), null);
  assert.equal(extremes(null), null);
  const e = extremes([{ luminance: 0.2 }, { luminance: 0.9 }, { luminance: 0.5 }]);
  assert.deepEqual(e, { min: 0.2, max: 0.9 });
});

// --------------------------------------------------------- the whole axis

test("BOTH modes are required — an absent dark is refused, not mirrored", () => {
  // The obvious rule is normalizeSeeds's: an absent dark mirrors the light. It
  // is wrong here and measurably so. That one DERIVES a dark palette by flipping
  // lightness; a gradient has no such derivation, so mirroring can only COPY —
  // and a light wash copied onto a dark page leaves the quiet ink at 2.57:1
  // against 4.96:1 in light, so the legibility gate refuses it every time. The
  // customer would then be told the contrast failed, when what actually happened
  // is that we duplicated a wash nobody wrote for that mode.
  const r = readAuthored({ light: ["linear-gradient(#ffffff, #eeeeee)"] });
  assert.equal(r.ok, false, "a one-mode answer was accepted and will always be refused downstream");
  assert.match(r.why, /dark/);

  const both = readAuthored({ light: ["linear-gradient(#ffffff, #eeeeee)"], dark: ["linear-gradient(#111111, #222222)"] });
  assert.equal(both.ok, true, both.why);
  assert.notDeepEqual(both.layers.dark, both.layers.light);
});

test("ONE bad layer refuses the WHOLE axis, never half of it", () => {
  // Half an authored backdrop is a wash missing the layer that made it work,
  // published as though it were what was asked for. The caller's fallback is a
  // coherent design; half a gradient is not.
  const r = readAuthored({ light: ["linear-gradient(#fff, #eee)", "url(https://x.example/a.png)"] });
  assert.equal(r.ok, false);
  assert.match(r.why, /url\(\)/);
});

test("too many layers is refused", () => {
  const many = Array.from({ length: MAX_LAYERS + 1 }, () => "linear-gradient(#fff, #000)");
  assert.match(readAuthored({ light: many }).why, /layers/);
});

test("a non-pair is refused rather than guessed at", () => {
  for (const junk of [null, "linear-gradient(#fff,#000)", ["a"], 42, {}, { dark: ["linear-gradient(#fff,#000)"] }]) {
    assert.equal(readAuthored(junk).ok, false, JSON.stringify(junk) + " was accepted");
  }
});

test("a single layer may be written bare rather than as a list", () => {
  // The model writes one gradient far more often than four, and refusing the
  // natural shape is the false-alarm class this file exists to avoid.
  const r = readAuthored({ light: "linear-gradient(#fff, #eee)", dark: "linear-gradient(#111, #222)" });
  assert.equal(r.ok, true, r.why);
  assert.equal(r.layers.light.length, 1);
});

test("the two modes are read INDEPENDENTLY — a bad dark refuses the axis", () => {
  const r = readAuthored({ light: ["linear-gradient(#fff, #eee)"], dark: ["url(https://x.example/a.png)"] });
  assert.equal(r.ok, false, "a bad dark half was accepted");
});

test("only the theme-dependent refusal is flagged as one", () => {
  // `needsVars` is what lets a caller with no palette tell "the model wrote
  // something wrong" from "I cannot judge this here". Getting the SET right is
  // the whole thing: flag too many and the Worker stops reporting real
  // refusals, flag too few and it reports one the container will not make.
  //
  // Every failure but the unresolved token is a fact about the TEXT, decidable
  // anywhere. Driven rather than reasoned, because a new rule added to
  // `readLayer` without a thought about this is exactly how the set drifts.
  const themeFree = [
    ["", "empty"],
    ["x".repeat(MAX_LAYER + 1), "too long"],
    ["linear-gradient(1deg, #fff, #000) /* hi */", "a comment"],
    ["linear-gradient(1deg, #fff, #000); color: red", "a semicolon"],
    ["linear-gradient(1deg, #fff, #000", "unbalanced"],
    ["url(http://x/y.png)", "url()"],
    ["color-mix(in oklch, #fff, #000)", "color-mix()"],
    ["linear-gradient(90dge, #fff, #000)", "a misspelt unit"],
  ];
  for (const [layer, why] of themeFree) {
    const r = readLayer(layer);
    assert.equal(r.ok, false, `${why} was accepted`);
    assert.ok(!r.needsVars, `${why} was flagged as needing a palette, so a Worker with none would let it through`);
  }
  const tokened = readLayer("linear-gradient(1deg, var(--primary), #fff)");
  assert.equal(tokened.ok, false);
  assert.equal(tokened.needsVars, true, "the ONE failure that depends on the palette is not marked as one");
});

test("the flag survives readAuthored, or the caller above cannot see it", () => {
  const spec = { light: ["linear-gradient(1deg, var(--primary), #fff)"], dark: ["linear-gradient(1deg, #000, #111)"] };
  assert.equal(readAuthored(spec).needsVars, true);
  // …and it is NOT set for an ordinary refusal, in the same shape.
  const bad = { light: ["url(http://x/y.png)"], dark: ["linear-gradient(1deg, #000, #111)"] };
  assert.ok(!readAuthored(bad).needsVars);
});

test("with a palette, a token resolves and the extremes are real", () => {
  const vars = { light: { "--primary": "#b4542e" }, dark: { "--primary": "#e08a60" } };
  const r = readAuthored({
    light: ["linear-gradient(1deg, var(--primary), #ffffff)"],
    dark: ["linear-gradient(1deg, var(--primary), #000000)"],
  }, { vars });
  assert.equal(r.ok, true, r.why);
  assert.doesNotMatch(r.layers.light.join(""), /var\(/, "a var() survived into the emitted value");
  const lit = extremes(r.colors.light);
  assert.ok(lit && lit.max > 0.9, "white did not read as the light extreme");
  assert.ok(lit.min < 0.3, "the brand colour did not read as the dark extreme");
});
