// THE MODEL WRITES ITS OWN CSS, ON EVERY AXIS.
//
// This module is the door between a model's answer and a customer's live
// stylesheet, so every test here is either a REFUSAL that has to hold or a
// legitimate answer that must not be turned away. This repo rates a false alarm
// worse than the miss, and both directions are driven.
import test from "node:test";
import assert from "node:assert/strict";
import {
  AXIS_DECLS, AXIS_RAMPS, AUTHORED_ALL, MAX_BLOCK, MAX_DECLS,
  readDecls, readRamp, readAuthoredAxis, declsCss,
} from "../builder/site-authored.mjs";
import { AXES } from "../builder/site-style.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// THE COVERAGE PROPERTY, derived at BOTH ends. A hand-written list is what
// leaves the twenty-fourth axis unauthorable while every test passes.

test("every engine axis can be authored, and nothing else can", () => {
  const engine = Object.keys(AXES).sort();
  assert.deepEqual([...AUTHORED_ALL].sort(), engine,
    "an axis the engine has that nobody can author is the enum coming back by the side door");
  // The split is exhaustive and disjoint: an axis in both tables would be read
  // by whichever branch `readAuthoredAxis` happens to check first.
  for (const a of engine) {
    const decl = Object.hasOwn(AXIS_DECLS, a), ramp = Object.hasOwn(AXIS_RAMPS, a);
    assert.ok(decl !== ramp, a + " is in neither table or in both");
  }
});

test("every decls axis states the selector it lands on", () => {
  // The model never sees the selector, so the tool has to TELL it. Without this
  // the model is writing a hover state blind and guessing whether it applies to
  // the button or the card it sits in.
  for (const [a, spec] of Object.entries(AXIS_DECLS)) {
    assert.ok(spec.sel && spec.sel.length > 6, a + " does not say what it applies to");
    assert.ok(spec.image || Object.keys(spec.props || {}).length,
      a + " takes declarations and names no property it may write");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DECLARATIONS — the fourteen axes that ARE a block.

test("a real hover state is accepted, whole", () => {
  const r = readDecls("transform: translateY(-3px); box-shadow: 0 12px 28px -14px oklch(0 0 0 / 0.3)", { axis: "hover" });
  assert.equal(r.ok, true, r.why);
  assert.equal(r.decls.length, 2);
  assert.match(r.css, /transform: translateY\(-3px\);/);
  assert.match(r.css, /box-shadow: /);
});

test("WE emit the block — the model's own bytes never reach the stylesheet", () => {
  // The property, not a formatting preference. The pairs came out of a parser
  // that refused every character an escape would need, so re-serialising from
  // them means the text in a customer's file was assembled here. Passing the
  // input through leaves the model's bytes in the file and makes every future
  // refusal a claim about a scanner rather than about what is written.
  const r = readDecls("transform:translateY(-3px)   ;   opacity:0.9", { axis: "hover" });
  assert.equal(r.ok, true, r.why);
  assert.equal(r.css, "transform: translateY(-3px); opacity: 0.9;",
    "the emitted block is not the input's spacing — it is ours");
  assert.equal(declsCss(r.decls), r.css, "the emitter and the reader disagree");
});

test("a property the axis does not own is refused, and the message says what it DOES own", () => {
  // `display: none` on the card selector blanks every list on the site — not an
  // injection, and it publishes green.
  const r = readDecls("display: none", { axis: "hover" });
  assert.equal(r.ok, false);
  assert.match(r.why, /cannot set display/);
  assert.match(r.why, /transform/, "a refusal that does not say what IS allowed teaches nothing");
});

test("the injection characters are refused in a VALUE, not escaped", () => {
  // There is no correct escape for arbitrary text in a CSS value, and a
  // half-working one reads as protection that is not there.
  for (const bad of [
    "box-shadow: 0 0 0 red} body{display:none",
    "background-color: rgb(0 0 0)@import url(x)",
    "border-color: \"red\"",
    "transform: translateY(0)\\3b display:none",
    "box-shadow: 0 0 0 <script>",
  ]) {
    const r = readDecls(bad, { axis: "hover" });
    assert.equal(r.ok, false, "accepted: " + bad);
  }
});

test("url() is refused wherever it appears", () => {
  // A fetch the CSP refuses, or a data: URI putting arbitrary bytes on a
  // customer's site through a field meant to describe a style.
  assert.equal(readDecls("border-radius: url(https://x/y.png)", { axis: "corner" }).ok, false);
  assert.equal(readDecls("background-color: url(data:image/svg+xml,<svg/>)", { axis: "surface" }).ok, false);
});

test("a comment, an unbalanced bracket and !important are each refused", () => {
  assert.match(readDecls("box-shadow: 0 2px 4px black /* hi */", { axis: "skin" }).why, /comment/);
  assert.match(readDecls("transform: translateY(-2px", { axis: "hover" }).why, /unbalanced/);
  // `!important` is the theme's to decide: a model that reaches for it is
  // overriding a cascade it cannot see, and it wins over every later edit.
  assert.match(readDecls("transform: translateY(-2px) !important", { axis: "hover" }).why, /important/);
});

test("a property set twice is refused rather than silently taking the last one", () => {
  const r = readDecls("outline-width: 3px; outline-width: 4px", { axis: "focus" });
  assert.equal(r.ok, false);
  assert.match(r.why, /twice/);
});

test("a misspelt keyword is refused — it is valid CSS that paints nothing", () => {
  // `solidd` compiles and draws no outline; `ease-ou` silently makes a
  // transition linear. Both look like working code in a diff.
  assert.equal(readDecls("outline-style: solidd", { axis: "focus" }).ok, false);
  assert.equal(readDecls("outline-style: solid", { axis: "focus" }).ok, true);
  assert.equal(readDecls("transform: rotat(3deg)", { axis: "skin" }).ok, false);
});

test("a declaration block is a STRING, not anything stringifiable", () => {
  // `String(["transform: none"])` is `"transform: none"` — the coercion this
  // repo has shipped as a real bug three times, and it was live in this
  // function until its own test drove it.
  for (const junk of [["transform: none"], 42, null, undefined, {}, true]) {
    const r = readDecls(junk, { axis: "hover" });
    assert.equal(r.ok, false, "accepted " + JSON.stringify(junk));
  }
});

test("the caps bind", () => {
  assert.match(readDecls("opacity: " + "9".repeat(MAX_BLOCK), { axis: "hover" }).why, /longer than/);
  const many = Array.from({ length: MAX_DECLS + 1 }, () => "opacity: 1").join(";");
  assert.match(readDecls(many, { axis: "hover" }).why, /declarations/);
});

test("an unknown axis is refused rather than reaching a stylesheet", () => {
  assert.equal(readDecls("opacity: 1", { axis: "nonsense" }).ok, false);
  assert.equal(readAuthoredAxis("constructor", "opacity: 1").ok, false,
    "`AXIS_DECLS['constructor']` is truthy — the Object.hasOwn lesson");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PALETTE SPLIT. Deferred is not refused, and getting that wrong tells a
// customer their look failed while it is painting on their site.

test("a var() the Worker cannot resolve is DEFERRED, never refused", () => {
  const r = readDecls("background-color: var(--primary)", { axis: "hover" });
  assert.equal(r.ok, false);
  assert.equal(r.needsVars, true, "without this the Worker's note contradicts the container");
});

test("with a palette, the same value resolves and is checked strictly", () => {
  const vars = { "--primary": "oklch(0.6 0.2 30)" };
  const good = readDecls("background-color: var(--primary)", { axis: "hover", vars });
  assert.equal(good.ok, true, good.why);
  assert.match(good.css, /oklch\(0\.6 0\.2 30\)/, "the SUBSTITUTED literal ships, not the var()");
  // A token the palette does not hold is a real refusal once a palette exists.
  const bad = readDecls("background-color: var(--nope)", { axis: "hover", vars });
  assert.equal(bad.ok, false);
  assert.equal(bad.needsVars, true, "an unresolvable token with a palette in hand is still a palette question");
});

test("colours are READ, so the contrast floor still has something to measure", () => {
  // The whole reason the parser exists: a floor computed against a colour we
  // could not read is not a floor.
  const r = readDecls("background-color: oklch(0.6 0.2 30); border-color: #123456", { axis: "hover" });
  assert.equal(r.ok, true, r.why);
  assert.ok(r.colors.length >= 2, "the stops were not read: " + JSON.stringify(r.colors));
  for (const c of r.colors) assert.ok(Number.isFinite(c.luminance) && c.rgb, "unreadable colour got through");
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKDROP AND DECOR keep the pair shape they already had.

test("backdrop and decor take a light/dark PAIR and keep their layer shape", () => {
  const r = readAuthoredAxis("backdrop", {
    light: ["linear-gradient(#f00,#00f)"],
    dark: ["linear-gradient(#001,#003)"],
  });
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(Object.keys(r.layers).sort(), ["dark", "light"],
    "the container composites two modes; a decls list would not reach either");
  // Delegated to `readAuthored`, NOT `readLayer` — the difference is a coercion.
  // A bare list would be `String()`d by the one-layer reader and accepted.
  assert.equal(readAuthoredAxis("backdrop", ["linear-gradient(#f00,#00f)"]).ok, false);
  // Half an answer is refused where the reason can say what it is: a light wash
  // copied onto a dark page leaves the quiet ink at 2.57:1.
  assert.match(readAuthoredAxis("backdrop", { light: ["linear-gradient(#f00,#00f)"] }).why, /dark/);
});

// ─────────────────────────────────────────────────────────────────────────────
// RAMPS — the nine that emit a generated ramp rather than a block.

test("a ramp is accepted in exactly the shape its emitter already reads", () => {
  // So an authored ramp and a named one are indistinguishable downstream, and
  // no emitter has to learn a second shape.
  assert.deepEqual(readRamp({ ratio: 1.28 }, { axis: "scale" }).value, { ratio: 1.28 });
  assert.deepEqual(readRamp({ steps: [1.1, 1.3, 1.5, 1.7] }, { axis: "leading" }).value, { steps: [1.1, 1.3, 1.5, 1.7] });
  assert.deepEqual(readRamp({ ms: 220, ease: "ease-out" }, { axis: "motion" }).value, { ms: 220, ease: "ease-out" });
});

test("THE UNIT IS THE FIELD'S, never the input's", () => {
  // `border-width` is px, `--spacing` is a rem step, `stroke-width` is
  // unitless. Trusting the input's unit is how `border: { width: "2rem" }`
  // becomes a 32-pixel border on every element on the site and still compiles.
  assert.equal(readRamp({ width: 2 }, { axis: "border" }).value.width, "2px");
  assert.equal(readRamp({ width: "2rem" }, { axis: "border" }).value.width, "2px");
  assert.equal(readRamp({ spacing: 0.3 }, { axis: "density" }).value.spacing, "0.3rem");
  assert.equal(readRamp({ width: 1.4 }, { axis: "icon" }).value.width, "1.4");
});

test("every ramp bound binds, and each is a rendering failure", () => {
  assert.match(readRamp({ ratio: 2.4 }, { axis: "scale" }).why, /between/, "an h1 taller than a phone screen");
  assert.match(readRamp({ steps: [0.4, 1, 1.2, 1.4] }, { axis: "leading" }).why, /between/, "lines overlapping");
  assert.match(readRamp({ steps: [100, 200, 300, 400, 500, 600, 950] }, { axis: "weight" }).why, /between/);
  assert.match(readRamp({ ms: 5000, ease: "linear" }, { axis: "motion" }).why, /between/, "a 5s hover reads as broken");
});

test("a ramp must run smallest to largest, because it is read by INDEX", () => {
  // Out of order it still renders, and what it renders is a heading lighter
  // than its own body copy.
  const r = readRamp({ steps: [900, 300, 400, 600, 800, 850, 900] }, { axis: "weight" });
  assert.equal(r.ok, false);
  assert.match(r.why, /smallest to largest/);
});

test("a ramp list must be exactly as long as the emitter indexes", () => {
  assert.match(readRamp({ steps: [0, 0.1] }, { axis: "tracking" }).why, /6 numbers/);
  assert.match(readRamp({ steps: [1, 1.2, 1.4] }, { axis: "leading" }).why, /4 numbers/);
});

test("a ramp refuses coercion and a missing field", () => {
  assert.match(readRamp({ width: ["1.4"] }, { axis: "icon" }).why, /not a number/);
  assert.match(readRamp({ steps: "200,300" }, { axis: "weight" }).why, /7 numbers/);
  assert.match(readRamp({}, { axis: "icon" }).why, /missing width/);
  assert.match(readRamp({ ms: 200 }, { axis: "motion" }).why, /missing ease/);
  for (const junk of [null, undefined, [], "1.4", 1.4]) {
    assert.equal(readRamp(junk, { axis: "icon" }).ok, false, "accepted " + JSON.stringify(junk));
  }
});

test("an easing is validated, and an injection through it is refused", () => {
  assert.equal(readRamp({ ms: 200, ease: "cubic-bezier(.2,.8,.2,1)" }, { axis: "motion" }).ok, true);
  assert.equal(readRamp({ ms: 200, ease: "steps(4, jump-end)" }, { axis: "motion" }).ok, true);
  assert.equal(readRamp({ ms: 200, ease: "ease-ou" }, { axis: "motion" }).ok, false, "a misspelling makes it linear, silently");
  assert.equal(readRamp({ ms: 200, ease: "linear} body{display:none" }, { axis: "motion" }).ok, false);
  assert.equal(readRamp({ ms: 200, ease: "url(x)" }, { axis: "motion" }).ok, false);
});

// ─────────────────────────────────────────────────────────────────────────────

test("one door answers for both shapes, so no caller has to know which", () => {
  // What keeps the cap, the merge and the refusal reporting identical across all
  // 23 — and stops the two shapes becoming two code paths that drift.
  assert.equal(readAuthoredAxis("hover", "opacity: 0.9").ok, true);
  assert.equal(readAuthoredAxis("icon", { width: 1.4 }).ok, true);
  assert.equal(readAuthoredAxis("backdrop", { light: ["#f0a"], dark: ["#204"] }).ok, true);
  assert.equal(readAuthoredAxis("nope", "opacity: 1").ok, false);
});

test("nothing throws, on any shape the wire can carry", () => {
  // This reads model output on the build path. A throw here is a 502 wearing a
  // model-outage message on a build that was merely written oddly.
  const junk = [null, undefined, 0, "", [], {}, true, { light: 1 }, { steps: {} }, "a:b:c", ";;;", ":"];
  for (const a of AUTHORED_ALL) {
    for (const j of junk) {
      assert.doesNotThrow(() => readAuthoredAxis(a, j), a + " threw on " + JSON.stringify(j));
    }
  }
});
