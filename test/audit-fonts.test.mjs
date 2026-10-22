// Audit A19-1, A20-1, A20-2 (2026-10-22): a family the model names must reach
// a registered face, in every shape the sheet can name it, and a family that
// cannot be had must be said.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fontsIn, aliasFonts, readCss } from "../builder/site-freecss.mjs";

test("A20-2: the css tool's own example (a token only) is read", () => {
  const r = fontsIn(':root{--font-sans:"Lora", Georgia, serif}');
  assert.deepEqual(r.ids, ["lora"]);
  assert.deepEqual(fontsIn(':root{--font-heading:"Fraunces",Georgia,serif}').ids, ["fraunces"]);
});

test("A20-2: every declaration of a stack property, page-scoped included", () => {
  const r = fontsIn(':root{--font-heading:"Lora",serif} body[data-page="/menu"]{--font-heading:"Caveat",cursive} h1{font-family:var(--font-heading)}');
  assert.deepEqual(r.ids.sort(), ["caveat", "lora"]);
});

test("A20-2: the font shorthand and a var() fallback", () => {
  assert.deepEqual(fontsIn('h1{font:700 2rem/1.1 "Fraunces",serif}').ids, ["fraunces"]);
  assert.deepEqual(fontsIn('h1{font:italic large Lora, serif}').ids, ["lora"]);
  assert.deepEqual(fontsIn('h1{font-family:var(--x,"Fraunces"),serif}').ids, ["fraunces"]);
  // controls: a keyword shorthand, a size property, a non-font custom property
  assert.deepEqual(fontsIn("p{font:inherit} h1{font-size:2rem} :root{--font-size:Lora}").ids, []);
  assert.deepEqual(fontsIn('/* --font-sans:"Lora" */ p{color:red}').ids, []);
});

test("A20-2: a family that cannot be had in any new shape is still reported", () => {
  const r = readCss(':root{--background:#fff;--foreground:#000;--font-sans:"Helvetica Nowhere Grotesk Zz", serif}');
  assert.deepEqual(r.missingFonts, ["Helvetica Nowhere Grotesk Zz"]);
  assert.ok(r.notes.some((n) => /not ones we can host/.test(n) && n.includes("Helvetica Nowhere Grotesk Zz")));
});

test("A20-1 / A19-1: the registered family follows the model's spelling in every stack", () => {
  const css = 'h1,h2{font-family:"Playfair Display",Georgia,serif} :root{--font-sans:"Lora", Georgia, serif} p{font:700 1rem/1.4 Inter, sans-serif} .q{font-family:Baskerville, serif}';
  const r = fontsIn(css);
  const out = aliasFonts(css, r.spellings);
  assert.match(out, /"Playfair Display", "Playfair Display Variable",Georgia,serif/);
  assert.match(out, /--font-sans:"Lora", "Lora Variable", Georgia, serif/);
  assert.match(out, /font:700 1rem\/1\.4 Inter, "Inter Variable", sans-serif/);
  assert.match(out, /Baskerville, "Baskervville", serif/);
  // idempotent, and a stack already naming the registered face is untouched
  assert.equal(aliasFonts(out, fontsIn(out).spellings), out);
  const v = 'h1{font-family:"Lora Variable",serif}';
  assert.equal(aliasFonts(v, fontsIn(v).spellings), v);
});

test("A20-1: readCss carries the spellings and the container writes the aliased sheet", () => {
  const r = readCss(':root{--background:#fff;--foreground:#000;--font-heading:"Playfair Display",serif}');
  assert.deepEqual(r.fontSpellings, [{ name: "Playfair Display", id: "playfair-display", family: "Playfair Display Variable" }]);
  assert.equal(r.css.includes("Playfair Display Variable"), false, "the stored sheet stays the model's words");
  const src = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const at = src.indexOf("function writeCss(css)");
  assert.ok(at > 0);
  assert.match(src.slice(at, at + 3000), /aliasFonts\(report\.css, report\.fontSpellings\)/);
  assert.match(src, /could not be downloaded, so they fall back to a system font/);
});
