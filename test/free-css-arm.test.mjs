// THE FREE-CSS ARM — the experiment's door, and the guards on it.
//
// This is the ONE look door on the platform with no validator behind it: the
// model picks its own selectors and properties and we append the result to a
// published site's stylesheet. That is the whole point of the arm — a validator
// here would measure the validator — and it means every guard below is about
// the same thing: THE ARM MUST BE OFF UNLESS SOMEBODY ASKED FOR IT BY NAME.
//
// The dangerous direction is not a wrong answer, it is a DEFAULT. A truthy
// check, a missing gate, or a `css` field left standing in the tool would each
// turn the arm on for a build that never requested it, and the only symptom is
// a customer's stylesheet quietly carrying `display:none`.
import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

// Prose describing a thing contains that thing's spelling — recorded in this
// repo in a lint, a router guard, an absence check, a scope scan and a
// mutation. Every absence below is judged against blanked comments.
const blank = (src) => src
  .replace(/^[ \t]*\/\/.*$/gm, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\*.*$/gm, (m) => " ".repeat(m.length))
  .replace(/^[ \t]*\/\*+.*$/gm, (m) => " ".repeat(m.length));
const wCode = blank(worker);
const sCode = blank(server);

test("the arm is off unless the caller asks for it, and asks STRICTLY", () => {
  // `=== true` and nothing looser. A body is attacker-shaped input; `"false"`,
  // `1` and `[]` are all truthy, and any of them turning this on means a
  // stylesheet with no validator in front of it on somebody's live site.
  assert.match(wCode, /const freeCssArm = body\.freeCss === true;/,
    "the free-CSS switch is gone, or is no longer a strict === true check");
  // The inverse: no truthiness anywhere near it.
  assert.ok(!/freeCss\s*(\|\||&&|\?)/.test(wCode.replace(/freeCssArm/g, "")),
    "body.freeCss is being read somewhere other than the one strict switch");
});

test("the payload carries css ONLY when the arm was asked for", () => {
  // Gated on the FLAG as well as the field. The tool has no `css` property at
  // all unless the arm is on, so a value present on an ordinary build could
  // only be a model inventing a field — which is exactly the shape that must
  // not reach a stylesheet.
  const at = wCode.indexOf("{ css: designed.css }");
  assert.ok(at > 0, "the free-CSS payload field is gone");
  const gate = wCode.slice(Math.max(0, at - 400), at);
  assert.match(gate, /freeCssArm &&/, "the css payload field is no longer gated on the arm being on");
  assert.match(gate, /typeof \(designed && designed\.css\) === "string"/,
    "the css payload field no longer requires a string — String(['a']) is 'a'");
});

test("the tool REPLACES the 29 axes rather than adding a field beside them", () => {
  // A `css` field sitting next to 29 named axes is a hatch beside a full menu,
  // and RUN 14 measured what a model does with one of those: it picked names
  // off the lists and opened the hatch on neither axis that had one. The arm
  // only means anything if the axes are not there.
  const at = wCode.indexOf("if (freeCss) {");
  assert.ok(at > 0, "the tool swap is gone");
  const swap = wCode.slice(at, at + 1200);
  assert.match(swap, /style: _dropped/, "the swap no longer DROPS the style axes — this is a hatch, not an arm");
  assert.match(swap, /css: FREE_CSS_FIELD/, "the swap no longer adds the css field");
});

test("the swap moves `required` with the property, or the tool is malformed", () => {
  // `style` is in the BUILD's required list. Dropping only the property leaves
  // a schema whose `required` names a field it does not have — which an API is
  // entitled to refuse, and a 400 here is every build on this arm dying at
  // stage "design" for a reason that reads like the provider being down.
  const at = wCode.indexOf("if (freeCss) {");
  const swap = wCode.slice(at, at + 1200);
  assert.match(swap, /filter\(\(k\) => k !== "style"\)/,
    "`style` is no longer removed from required — the swapped tool names a property it does not have");
  assert.match(swap, /, "css"\]/,
    "`css` is no longer required — a model that omits it gives this arm the plain theme and a null result");
});

test("the swapped tool is well-formed — driven, not read", () => {
  // THE ONLY CHECK HERE THAT EXECUTES THE SWAP. Everything else above reads the
  // source, and a source-read cannot tell a schema that composes from one that
  // names a property it dropped. Rebuilt from the real tool the way the Worker
  // does it, then both arms checked for the one property a tool must have:
  // every name in `required` exists in `properties`.
  const at = worker.indexOf("const SITE_SCHEMA_TOOL");
  assert.ok(at > 0, "SITE_SCHEMA_TOOL is gone — this check is measuring nothing");
  // The required list is read out of the real source rather than restated, so
  // a field added to it tomorrow is covered with nothing edited here.
  const reqLine = worker.slice(at).match(/\n {4}required: \[([^\]]*)\]/);
  assert.ok(reqLine, "the build's required list could not be read — retarget this check");
  const required = reqLine[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  assert.ok(required.includes("style"), "`style` left the required list — the swap's filter is now a no-op");
  // Arm A's list, built by the same expression the Worker uses.
  const armA = [...required.filter((k) => k !== "style"), "css"];
  assert.ok(!armA.includes("style"), "arm A still requires `style`, which it deleted");
  assert.ok(armA.includes("css"), "arm A does not require the one field it exists to collect");
  // And the two arms differ by EXACTLY that swap — nothing else moved.
  assert.deepStrictEqual(
    [...armA].sort().filter((k) => k !== "css"),
    [...required].sort().filter((k) => k !== "style"),
    "the arms differ by more than style-for-css — then the experiment has a second variable in it");
});

test("the swap composes with the edit swap rather than racing it", () => {
  // Both lines rebuild `req.tools`. If this one read SITE_SCHEMA_TOOL instead
  // of req.tools[0] it would silently undo whatever `required` the edit line
  // settled on — which on a revise is the whole edit contract lost.
  const at = wCode.indexOf("if (freeCss) {");
  const swap = wCode.slice(at, at + 500);
  assert.ok(!/SITE_SCHEMA_TOOL/.test(swap),
    "the free-CSS swap rebuilds from SITE_SCHEMA_TOOL, so it undoes the edit swap above it");
  assert.match(swap, /req\.tools\[0\]\.input_schema/,
    "the free-CSS swap no longer reads from what the edit swap produced");
  // And it must come AFTER, or the edit swap is the one doing the undoing.
  const editAt = wCode.indexOf("if (current) req.tools =");
  assert.ok(editAt > 0 && editAt < at, "the free-CSS swap no longer comes after the edit swap");
});

test("an ordinary build is byte-identical to this never existing", () => {
  // The container's door returns before touching the stylesheet on anything
  // that is not a non-empty string, so a payload with no `css` writes nothing.
  const at = sCode.indexOf("function writeFreeCss");
  assert.ok(at > 0, "writeFreeCss is gone");
  const fn = sCode.slice(at, sCode.indexOf("\n}", at));
  assert.match(fn, /typeof css !== "string"/,
    "writeFreeCss no longer refuses a non-string — String(['a']) is 'a', the coercion this repo has shipped three times");
  assert.match(fn, /!css\.trim\(\)/, "writeFreeCss no longer returns early on an empty string");
  // The early return must come BEFORE any write.
  const guardAt = fn.indexOf("typeof css !== \"string\"");
  const writeAt = fn.indexOf("writeFileSync");
  assert.ok(guardAt > 0 && writeAt > guardAt, "writeFreeCss writes before it checks what it was given");
});

test("the free CSS is written LAST, after every other look writer", () => {
  // Later wins, which is the same mechanism the token override rests on:
  // whatever the model wrote beats the axes on any declaration they both make.
  // Written earlier, the axes would silently overrule the arm and the
  // experiment would measure nothing.
  const theme = sCode.indexOf("const themeUsed = writeTheme(");
  const tokens = sCode.indexOf("const tokensUsed = writeTokens(");
  const pageTokens = sCode.indexOf("const pageTokensUsed = writePageTokens(");
  const free = sCode.indexOf("const freeCssUsed = writeFreeCss(");
  for (const [name, at] of [["theme", theme], ["tokens", tokens], ["pageTokens", pageTokens], ["free", free]]) {
    assert.ok(at > 0, `the ${name} writer call is gone — this ordering check is measuring nothing`);
  }
  assert.ok(free > pageTokens && free > tokens && free > theme,
    "the free CSS is no longer written last, so the axes overrule it");
});

test("the arm is bounded, because nothing else bounds it", () => {
  // Every other door here has a parser that refuses. This one has a length cap
  // and that is the whole of it — the stylesheet ships to every visitor.
  const at = sCode.indexOf("function writeFreeCss");
  const fn = sCode.slice(at, sCode.indexOf("\n}", at));
  assert.match(fn, /const MAX = \d+;/, "the free-CSS length bound is gone");
  assert.match(fn, /css\.length > MAX \? css\.slice\(0, MAX\)/, "the bound is no longer applied");
  // And a cut says so, rather than silently shipping half a stylesheet.
  assert.match(fn, /notes: css\.length > MAX/, "a truncated stylesheet is no longer reported");
});

test("the container reports the arm only when it applied", () => {
  // Omitted otherwise, so an ordinary build's response is unchanged and the
  // field's PRESENCE is the signal — the shape `salvageNote` and `partial`
  // already use here.
  assert.match(sCode, /\.\.\.\(freeCssUsed\.applied \? \{ freeCss: freeCssUsed \} : \{\}\)/,
    "the container no longer reports the arm, or reports it on every build");
});
