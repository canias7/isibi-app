// The rest of the look, and whether it is REACHABLE.
//
// This repo has recorded a feature dead at one silent link more times than any
// other class of bug, and the shape is always the same: the module is correct,
// every unit test passes, and one wiring layer never carries the value. So the
// module's own behaviour is the smaller half of this file — the larger half is
// the chain from a model's answer to a rule in a published stylesheet.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AXES, ASKABLE, MAX_STYLE, RADIUS_AXES,
  optionsFor, parseStyle, mergeStyle, applyStyle, explicitRadiusCss,
  styleNote, saidFor, axisHint,
} from "../builder/site-style.mjs";
import * as T from "../builder/site-theme.mjs";
import { stripThemeRadius } from "../builder/site-tokens.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

/* ------------------------------------------------------------------ parsing */

test("an axis and an option the engine knows are kept", () => {
  assert.deepEqual(parseStyle({ buttons: "pill", density: "airy" }).style,
    { buttons: "pill", density: "airy" });
});

test("an unknown axis and an unknown option are both DROPPED, never guessed", () => {
  const out = parseStyle({ buttons: "pill", nope: "x", density: "SPACIOUS" });
  assert.deepEqual(out.style, { buttons: "pill" });
  assert.deepEqual(out.dropped.sort(), ["density", "nope"]);
});

test("the value must be a STRING, not anything stringifiable", () => {
  // `String(["pill"])` is `"pill"`, so a one-element array passes a shape test
  // and sets a real axis from a value nobody wrote. The `normalizeRole` lesson,
  // and the same one that let `access: ["display"]` through on a table deciding
  // who may read customer data.
  for (const bad of [["pill"], { toString: () => "pill" }, 7, true, null, undefined]) {
    assert.deepEqual(parseStyle({ buttons: bad }).style, {},
      "a non-string set an axis: " + JSON.stringify(bad));
  }
});

test("a prototype name is not an axis", () => {
  // `AXES["constructor"]` is a function — truthy, so a plain lookup walks past a
  // `|| null`. The exact bug that shipped in the Stripe plan lookup and again in
  // `resolveTheme`.
  for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    assert.deepEqual(parseStyle({ [name]: "pill" }).style, {}, name + " was treated as an axis");
  }
  // And the same on the OPTION, where the lookup is into a theme constant.
  assert.deepEqual(parseStyle({ buttons: "constructor" }).style, {});
});

test("names are normalised the way a customer's answer arrives", () => {
  assert.deepEqual(parseStyle({ "  Buttons ": "  PILL " }).style, { buttons: "pill" });
});

test("the array shape a model sometimes answers with is read too", () => {
  assert.deepEqual(parseStyle([{ axis: "buttons", option: "sharp" }, { name: "density", value: "airy" }]).style,
    { buttons: "sharp", density: "airy" });
});

test("junk in cannot throw — this runs on every build", () => {
  for (const bad of [null, undefined, 7, "buttons", [], {}, [null, 3, "x"]])
    assert.deepEqual(parseStyle(bad).style, {}, "threw or answered oddly on " + JSON.stringify(bad));
});

test("more than MAX_STYLE is a re-theme, and the extras are REPORTED", () => {
  const many = Object.fromEntries(ASKABLE.map((a) => [a, optionsFor(a)[1]]));
  const out = parseStyle(many);
  assert.equal(Object.keys(out.style).length, MAX_STYLE);
  assert.equal(out.dropped.length, ASKABLE.length - MAX_STYLE,
    "an over-cap axis was silently discarded rather than reported");
});

/* ------------------------------------------------------------------- merging */

test("a patch ACCUMULATES — a revise names only what it is changing", () => {
  // THE FAILURE THIS PREVENTS. Square buttons asked for today and airy spacing
  // tomorrow both have to survive; a replacing merge hands back the theme's own
  // buttons on the second revise, which reads as the first instruction being
  // forgotten.
  assert.deepEqual(mergeStyle({ buttons: "sharp" }, { density: "airy" }),
    { buttons: "sharp", density: "airy" });
});

test("the newest answer wins on the same axis", () => {
  assert.deepEqual(mergeStyle({ buttons: "sharp" }, { buttons: "pill" }), { buttons: "pill" });
});

test("over the cap, the NEW keys are the ones kept", () => {
  const prior = Object.fromEntries(ASKABLE.slice(0, MAX_STYLE).map((a) => [a, optionsFor(a)[1]]));
  const merged = mergeStyle(prior, { inputs: "filled" });
  assert.equal(Object.keys(merged).length, MAX_STYLE);
  assert.equal(merged.inputs, "filled",
    "the instruction the customer is looking at the result of was the one dropped");
});

test("a stored patch that has gone bad does not poison the merge", () => {
  assert.deepEqual(mergeStyle({ buttons: "banana", nope: 7 }, { density: "airy" }), { density: "airy" });
});

/* ------------------------------------------------------------------ applying */

test("applyStyle merges the axes onto the theme", () => {
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  const out = applyStyle(theme, { buttons: "sharp", density: "airy" });
  assert.equal(out.buttons, "sharp");
  assert.equal(out.density, "airy");
  assert.equal(out.light, theme.light, "the palette was not carried through");
});

test("NOTHING VALID MEANS THE THEME ITSELF, not a copy", () => {
  // A site that never asked for a patch must get a byte-identical stylesheet to
  // the build before this existed. Identity is the strongest way to say so.
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  for (const nothing of [null, undefined, {}, { nope: "x" }, { buttons: "banana" }])
    assert.equal(applyStyle(theme, nothing), theme, "a no-op patch replaced the theme object");
});

test("a missing theme stays missing", () => {
  // `writeTheme` fails soft on an unresolved theme; inventing an object here
  // would turn that fail-soft into a look that is neither the theme nor the
  // template's own.
  for (const bad of [null, undefined, "chalk", 7]) assert.equal(applyStyle(bad, { buttons: "pill" }), bad);
});

test("THE MERGED THEME REALLY RENDERS DIFFERENTLY — the whole mechanism, driven", () => {
  // Not "applyStyle returned an object with the field on it" — the property that
  // matters is that the theme engine ACTS on it. Every axis is driven, because a
  // twelve-axis feature where two happen to be read is the shape this repo keeps
  // shipping.
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  const base = T.themeCss(theme);
  assert.ok(base && base.length > 500, "the reference theme did not render");
  for (const axis of ASKABLE) {
    // EVERY option, and at least one must move the CSS. Picking "the first one
    // that is not the theme's own" looked right and was wrong: three axes have
    // a no-op default FIRST (`inherit`, `standard`, `ink`) and a theme that
    // leaves the field absent means exactly that default — so the search
    // returned the no-op and the assertion failed on an axis that works.
    const moved = optionsFor(axis).filter((o) => T.themeCss(applyStyle(theme, { [axis]: o })) !== base);
    assert.ok(moved.length, "no option of `" + axis + "` changes the rendered CSS at all");
  }
});

/* ------------------------------------------ the one place two patches collide */

test("RADIUS_AXES is the WHOLE truth, derived from the engine", () => {
  // The list is held in code because deriving it needs twelve emitters with
  // three different signatures and a theme to evaluate them against. That is
  // exactly the kind of hand-maintained fact that rots, so the truth is derived
  // HERE: an axis that starts emitting a corner radius and is not in the list
  // would be silently stripped whenever a customer also asks for a radius.
  const theme = T.THEMES[Object.keys(T.THEMES)[0]];
  const found = [];
  for (const axis of ASKABLE) {
    for (const option of optionsFor(axis)) {
      const css = T.themeCss(applyStyle(theme, { [axis]: option })) || "";
      const bare = T.themeCss(applyStyle(theme, {})) || "";
      // Only what this axis ADDS: the theme's own rules are in both.
      const added = css.split("\n").filter((l) => !bare.includes(l)).join("\n");
      if (/border-radius/i.test(added) && !found.includes(axis)) found.push(axis);
    }
  }
  assert.deepEqual(found.sort(), [...RADIUS_AXES].sort(),
    "an axis emits a border-radius and is not in RADIUS_AXES — a strip will eat it");
});

test("the customer's OWN corner opinion survives a radius strip", () => {
  // "rounder corners AND pill buttons" got the first and silently lost the
  // second: `stripThemeRadius` is a regex and cannot tell a theme's hard-set
  // button radius from the one just asked for.
  const css = explicitRadiusCss({ buttons: "pill", inputs: "underline" });
  assert.match(css, /border-radius:\s*9999px/, "the explicit pill was not re-emitted");
  assert.match(css, /\.border-input/, "the explicit input style was not re-emitted");
  assert.equal(stripThemeRadius(css).includes("9999px"), false,
    "the fixture is wrong — the strip does not touch this, so the test proves nothing");
});

test("an axis nobody named re-emits NOTHING", () => {
  // Empty for a patch that did not mention them, so a colour-only or radius-only
  // change leaves every existing site exactly as it is.
  assert.equal(explicitRadiusCss({}), "");
  assert.equal(explicitRadiusCss({ density: "airy" }), "");
  assert.equal(explicitRadiusCss(null), "");
  // And empty for the no-op options, which mean "let the radius decide" —
  // which is precisely what the strip leaves behind.
  assert.equal(explicitRadiusCss({ buttons: "inherit", inputs: "standard" }), "");
});

/* --------------------------------------------------------------- the sentence */

test("what changed is said in the customer's words, not ours", () => {
  assert.equal(styleNote({ display: "accent" }, []), "Changed the heading colour.");
  assert.match(styleNote({ buttons: "pill", density: "airy", icon: "heavy" }, []),
    /button shape, spacing and icon weight/);
});

test("A REFUSED AXIS IS NAMED", () => {
  // Somebody who asks for something we cannot do, and is told nothing, reads the
  // unchanged page as the builder being broken rather than as a request that did
  // not land.
  const note = styleNote({}, ["shadow"]);
  assert.match(note, /Couldn’t change the shadows/);
  assert.equal(note.includes("Changed the"), false, "claimed a change on a patch that set nothing");
});

test("the note is empty when nothing was asked for", () => {
  // So a build that never mentioned the look has a byte-identical note block.
  assert.equal(styleNote({}, []), "");
  assert.equal(styleNote(null, null), "");
});

test("every axis has a plain name and it is not the engine's label", () => {
  for (const a of ASKABLE) {
    assert.ok(saidFor(a) && saidFor(a).length < 20, a + " has no usable plain name");
    const label = Object.values(AXES[a].options)[0].label;
    assert.notEqual(saidFor(a), label, a + " reuses the theme's own label, which is written for a chooser");
  }
  const said = ASKABLE.map(saidFor);
  assert.equal(new Set(said).size, said.length, "two axes share a plain name: " + said.join(", "));
});

/* ------------------------------------------------- derived from the engine */

test("EVERY AXIS IS THE ENGINE'S OWN LIST, in both directions", () => {
  // A restated option list is a second thing that can drift, and the direction
  // it drifts in is describing an option to the model that the engine then
  // refuses — reported to the customer as a change that did not happen.
  const byName = {
    corner: T.CORNERS, scale: T.TYPE_SCALES, tracking: T.TRACKINGS, leading: T.LEADINGS,
    weight: T.WEIGHTS, density: T.DENSITIES, border: T.BORDERS, icon: T.ICON_STROKES,
    shadow: T.SHADOWS, buttons: T.BUTTONS, inputs: T.INPUTS, display: T.DISPLAYS,
  };
  assert.deepEqual(ASKABLE.slice().sort(), Object.keys(byName).sort(),
    "AXES and this test disagree about which axes exist");
  for (const [a, real] of Object.entries(byName)) {
    assert.deepEqual(optionsFor(a), Object.freeze(Object.keys(real)), a + " restates the engine's options");
    assert.ok(optionsFor(a).length >= 2, a + " has fewer than two options — it is not a choice");
  }
});

test("every option carries a label, because the label IS the instruction", () => {
  // `pill` on its own is a guess; "fully round ends, whatever the cards do" is
  // an instruction. An option with no label reaches the model as a bare name.
  for (const a of ASKABLE) {
    for (const [o, def] of Object.entries(AXES[a].options))
      assert.ok(def && typeof def.label === "string" && def.label.length > 4,
        a + "." + o + " has no usable label");
    assert.ok(axisHint(a).includes(optionsFor(a)[0]), a + "'s hint does not name its own first option");
  }
  assert.equal(axisHint("nope"), "", "an unknown axis produced a hint");
});

test("THE WORLD AXES ARE DELIBERATELY ABSENT", () => {
  // A set whose whole job is being coherent with each other — `surfaceCss`
  // re-declares palette tokens with alpha and `worldCss` owns the body paint, so
  // glass on a theme with no backdrop has nothing to blur against. Pinned
  // because "we forgot it" and "we decided against it" look identical in a list
  // of names a year later.
  for (const a of ["surface", "backdrop", "decor", "ambient", "skin", "fonts", "radius"])
    assert.equal(ASKABLE.includes(a), false, a + " is askable — that is a re-theme, or a token");
});

/* -------------------------------------------------------------- the wiring */

test("THE CONTAINER MERGES BEFORE IT RENDERS", () => {
  // The whole mechanism is one call, and `build-server.mjs` cannot be imported
  // into a test that also drives the Worker, so it is read.
  assert.match(server, /import \{[^}]*applyStyle[^}]*\} from "\.\/site-style\.mjs"/,
    "the container does not import the module");
  assert.match(server, /themeCss\(applyStyle\(theme, style\)\)/,
    "the container renders the theme without the site's own axes");
  const i = server.indexOf("function writeTheme(");
  const sig = server.slice(i, server.indexOf(")", i) + 1);
  assert.match(sig, /style/, "writeTheme cannot be given a style patch");
  assert.match(server, /writeTheme\(payload\.theme, \{[^}]*style: payload\.style/,
    "the payload's style never reaches writeTheme");
  // AND THE COLLISION, which a mutation proved was covered by nothing: the
  // module's own test drives `explicitRadiusCss` in isolation, and the container
  // is where it has to be APPENDED. Deleting the append left "rounder corners
  // AND pill buttons" silently losing the buttons again, with every test green.
  const branch = server.slice(server.indexOf("const shaped = dropRadius"));
  const stmt = branch.slice(0, branch.indexOf(";") + 1);
  assert.match(stmt, /stripThemeRadius\(css\)/, "the strip is gone from the radius branch");
  assert.match(stmt, /explicitRadiusCss\(style\)/,
    "the strip runs without re-emitting the corner axes the customer named");
  assert.ok(stmt.indexOf("stripThemeRadius") < stmt.indexOf("explicitRadiusCss"),
    "the re-emit runs BEFORE the strip, which eats it");
});

test("THE CONTAINER IMAGE CARRIES THE MODULE", () => {
  // A module the Dockerfile does not COPY is an import that throws on startup,
  // which stops the build container rather than degrading anything. Caught this
  // way once already, for `site-tokens.mjs`.
  const dockerfile = fs.readFileSync(new URL("../builder/Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /\bsite-style\.mjs\b/, "site-style.mjs is not copied into the image");
});

test("EVERY CONTAINER PAYLOAD CARRIES THE PATCH", () => {
  // The container merges this into the theme on EVERY build — it has to, or one
  // site's look decisions leak onto the next — so a payload that does not send
  // the stored patch sends nothing, and nothing means the theme's own defaults.
  // A customer who asked for square buttons and then changed one word of copy
  // would have watched them go round again. The `priorLogo` failure exactly.
  //
  // `matchAll`, NOT `match` + `indexOf`. The two payload lines are BYTE
  // IDENTICAL, so `indexOf` answered the same position for both and the scan
  // checked one payload twice — a mutation deleting the other one's `style`
  // survived the whole suite. An assertion that cannot see half of what it
  // claims to cover is the shape this repo keeps recording.
  const payloads = [...worker.matchAll(/tokens: Object\.keys\(tokens \|\| \{\}\)\.length[^\n]*/g)];
  assert.equal(payloads.length, 2, "found " + payloads.length + " container payloads — the scan is broken");
  assert.notEqual(payloads[0].index, payloads[1].index, "the scan is reading one payload twice");
  for (const p of payloads) {
    const after = worker.slice(p.index, p.index + 900);
    assert.match(after, /style: Object\.keys\(style \|\| \{\}\)\.length \? style : undefined/,
      "a container payload sends the colours and not the rest of the look");
  }
});

test("THE BUILD PATH HANDS IT TO THE PUBLISHER", () => {
  // `buildAndPublishPages` reads `style` off its argument object and forwards it
  // to the container. A caller that never passes one forwards `undefined`
  // forever, and the payload assertion above stays perfectly green — which is
  // exactly what a mutation showed.
  //
  // ANCHORED ON `await`, because `buildAndPublishPages(env, {` matches the
  // DECLARATION too — `async function buildAndPublishPages(env, { brief, spec,
  // …` — whose destructuring braces close 190 characters later. That is the
  // `confirmSubmitter` failure this repo has already recorded twice: a
  // source-read must anchor on something only the thing being asserted can have.
  const at = worker.indexOf("await buildAndPublishPages(env, {");
  assert.ok(at > 0, "nothing calls buildAndPublishPages");
  assert.equal(worker.slice(at - 20, at).includes("function"), false, "anchored on the declaration");
  let depth = 0, i = worker.indexOf("{", at), end = i;
  for (; end < worker.length; end++) {
    if (worker[end] === "{") depth++;
    else if (worker[end] === "}") { depth--; if (!depth) { end++; break; } }
  }
  const args = worker.slice(i, end);
  assert.ok(args.length > 200 && args.length < 6000, "the argument scan is broken: " + args.length + " chars");
  assert.match(args, /tokens: siteTokens/, "the scan is wrong — it cannot even see the colours");
  assert.match(args, /style: siteStyle/, "the merged patch never reaches the publisher");
});

test("EVERY PAYLOAD PATH READS THE STORED PATCH", () => {
  // The other half, and either alone passes while the wire is cut: a payload
  // that faithfully sends an always-null variable is indistinguishable from one
  // that works.
  const rows = worker.match(/r\.k === "site_style"/g) || [];
  assert.equal(rows.length, 3, "expected the two payload paths and the look edit to read it, found " + rows.length);
  for (const q of worker.match(/SELECT k, v FROM _meta WHERE k IN \([^)]*\)/g) || []) {
    if (q.includes("site_logo")) assert.ok(q.includes("site_style"),
      "a payload-path read asks for the logo and not the style: " + q);
  }
});

test("IT IS ITS OWN _meta KEY, never a field on site_look", () => {
  // `mergeLook` rebuilds its output from `EDIT_FIELDS` alone, so anything else
  // stored on that object is dropped by the next look edit — the reason
  // `site_tokens` and `site_logo` are separate keys too.
  const edit = fs.readFileSync(new URL("../builder/site-edit.mjs", import.meta.url), "utf8");
  assert.equal(/EDIT_FIELDS = \[[^\]]*style/.test(edit), false,
    "style is on EDIT_FIELDS, where a look edit will drop it");
  assert.match(worker, /VALUES \('site_style', \?\)/, "nothing writes the style key");
  assert.equal((worker.match(/VALUES \('site_style', \?\)/g) || []).length, 2,
    "the build path and the look edit must both store it");
});

test("THE DESIGNER CAN ASK FOR IT, with the engine's own options", () => {
  // Unreachable from the tool is unreachable full stop — the state 14 other
  // schema features are in, fully built and declarable by nothing.
  assert.match(worker, /import \{[^}]*mergeStyle[^}]*\} from "\.\/builder\/site-style\.mjs"/);
  const at = worker.indexOf("      style: {");
  assert.ok(at > 0, "design_schema has no style field");
  const field = worker.slice(at, worker.indexOf("\n      },", at));
  assert.match(field, /SITE_STYLE_AXES\.map/, "the axes are restated rather than derived");
  assert.match(field, /enum: siteStyleOptions\(a\)/,
    "an option the engine would refuse is merely dropped rather than impossible");
  assert.match(field, /description: siteStyleHint\(a\)/, "the options reach the model unlabelled");
  assert.match(field, /Omit it entirely otherwise/,
    "nothing tells the model to leave it out on a first build");
});

test("A LOOK EDIT COUNTS IT AS A CHANGE", () => {
  // Without this, "square buttons" escalates to a ~27-credit page rewrite that
  // cannot put square buttons on anything either — the rung above recompiles
  // from the same stored look. The whole point of the lane is that a look change
  // costs one cheap call.
  assert.match(worker, /const styleMoved = JSON\.stringify\(nextStyle\) !== JSON\.stringify\(priorStyle \|\| \{\}\)/);
  assert.match(worker, /if \(!moved\.length && !tokensMoved && !styleMoved\) return escalate\("no-change"\)/,
    "a style-only edit escalates as though nothing had been asked for");
});

test("THE CUSTOMER IS TOLD, at both ends of the wire", () => {
  // Composed on the server because `public/chat.js` cannot import this module,
  // and a second copy there drifts toward claiming a change that did not happen.
  assert.match(worker, /styleNote: styleNote\(styleAsk\.style, styleAsk\.dropped\) \|\| undefined/);
  assert.equal((worker.match(/styleNote: styleNote\(/g) || []).length, 2,
    "the build path and the look edit must both say what happened");
  assert.match(chat, /d\.styleNote === 'string'/, "the client never renders the sentence");
  // The look lane's own reply joins a list of names, and they arrive already
  // plain — raw keys would print "Updated the look — display" about the heading
  // colour.
  assert.match(worker, /Object\.keys\(nextStyle\)\.map\(styleSaid\)/,
    "the look lane sends raw axis keys to a client that cannot translate them");
  assert.match(chat, /concat\(tokens, style\)/, "the client drops the style names from its sentence");
});
