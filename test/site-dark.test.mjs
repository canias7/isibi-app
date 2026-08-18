// Dark mode is ONE CLASS on `<html>`, and this holds the four facts that make
// that true.
//
// Every theme in the registry ships a DESIGNED dark palette — 31 colour
// properties, drawn by whoever drew the light half — and `themeCss` has emitted
// it as a `.dark` block into every site's stylesheet since the day themes
// existed. Nothing ever applied it. So all 500 themes shipped their dark half as
// dead CSS, and "make my site dark" was answered with a token patch: a dark
// ground under buttons, borders and highlights chosen for white paper.
//
// THE FEATURE IS CHEAP ONLY BECAUSE OF THINGS ONE LAYER DOWN, and each of them
// is one edit from being false:
//
//   `styles.css` declares `@custom-variant dark (&:is(.dark *))` — a CLASS,
//   not `prefers-color-scheme`. Change it to a media query and the class
//   applies to nothing, every dark site silently renders light, and no
//   typecheck, no bundle and no other test in this repo can see it.
//
//   `themeCss` emits a `.dark` block with a DIFFERENT palette. Emit the same
//   colours under both selectors and the class is inert in the other direction.
//
// So they are asserted here as the premise, rather than left as luck.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeMode } from "../builder/site-identity.mjs";
import { themeCss } from "../builder/site-theme.mjs";
import { resolveTheme, THEME_SHORTLIST } from "../builder/site-theme-registry.mjs";
import { EDIT_FIELDS } from "../builder/site-edit.mjs";

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const worker = read("../worker.js");
const server = read("../builder/build-server.mjs");
const root = read("../builder/lovable/template/src/routes/__root.tsx");
const styles = read("../builder/lovable/template/src/styles.css");
const brand = read("../builder/lovable/template/src/site-brand.ts");
const chat = read("../public/chat.js");

/* ── the premise ─────────────────────────────────────────────────────────── */

test("THE DARK VARIANT IS A CLASS, which is the whole reason this is one line", () => {
  // `&:is(.dark *)` — a DESCENDANT of an element carrying `.dark`. If this ever
  // becomes `@media (prefers-color-scheme: dark)` the site follows the VISITOR
  // rather than the owner, the class stops meaning anything, and every site the
  // owner asked to be dark renders light for anybody whose laptop is set to
  // light. Silent in every check this repo has.
  assert.match(styles, /@custom-variant\s+dark\s*\(&:is\(\.dark \*\)\)/);
  assert.doesNotMatch(styles, /@custom-variant\s+dark\s*\([^)]*prefers-color-scheme/);
});

test("EVERY THEME ALREADY CARRIES A DARK PALETTE, and it is a DIFFERENT one", () => {
  // Driven over the shortlist rather than one hand-picked theme: the claim is
  // about the registry, and a single theme happening to have a dark half proves
  // nothing about the other 499. `--background` is the load-bearing one — it is
  // what `bg-background` on every generated page's root div reads.
  let checked = 0;
  for (const id of THEME_SHORTLIST) {
    const t = resolveTheme(id);
    if (!t) continue;
    const css = themeCss(t);
    const light = (css.match(/:root\s*\{[^}]*--background:\s*([^;}]+)/) || [])[1];
    const dark = (css.match(/\.dark\s*\{[^}]*--background:\s*([^;}]+)/) || [])[1];
    assert.ok(light, id + " has no :root --background");
    assert.ok(dark, id + " emits no .dark --background — the class would apply to nothing");
    assert.notEqual(light.trim(), dark.trim(), id + " draws the same background in both modes");
    checked++;
  }
  // A LOOP THAT RAN OVER NOTHING PASSES EVERY ASSERTION IN IT. This repo has
  // shipped exactly that: `[].every(…)` reported a page clean while the render
  // had failed.
  assert.ok(checked >= 50, "only " + checked + " themes were checked, so the sweep has stopped sweeping");
});

/* ── the value ───────────────────────────────────────────────────────────── */

test("light is what everything unreadable becomes", () => {
  assert.equal(normalizeMode("dark"), "dark");
  assert.equal(normalizeMode(" DARK "), "dark");
  assert.equal(normalizeMode("Dark"), "dark");
  assert.equal(normalizeMode("light"), "light");
  // EVERY SITE PUBLISHED BEFORE THIS EXISTED sends nothing, so absent has to be
  // light or one deploy re-draws the whole platform.
  for (const v of [undefined, null, "", "   ", "auto", "system", "DARKISH", "night"]) {
    assert.equal(normalizeMode(v), "light", JSON.stringify(v));
  }
  // NOT COERCED. `String(["dark"])` is `"dark"` — the shape that made a
  // one-element array a valid role and a valid access level twice in this repo.
  for (const v of [["dark"], { toString: () => "dark" }, 1, true]) {
    assert.equal(normalizeMode(v), "light", JSON.stringify(v));
  }
});

/* ── the wiring, end to end ──────────────────────────────────────────────── */

test("the class is on <html>, from the value the container baked", () => {
  // ON `<html>`, NOT `<body>`, and it is not a style choice: the variant is
  // `&:is(.dark *)`, so the class has to sit ABOVE everything it is meant to
  // reach — and `<body>` already carries the per-page colour scope, which would
  // then be inside the dark scope rather than above it.
  assert.match(root, /<html lang=\{SITE_LANG\} className=\{SITE_MODE === "dark" \? "dark" : undefined\}>/);
  assert.match(root, /import \{[^}]*\bSITE_MODE\b[^}]*\} from "@\/site-brand"/);
  // …and never on the body, which is where a well-meaning tidy-up would put it.
  assert.doesNotMatch(root, /<body[^>]*SITE_MODE/);
});

test("the container writes it, ANNOTATED, and says what it drew", () => {
  assert.match(server, /const modeValue = normalizeMode\(mode\)/);
  // THE ANNOTATION IS LOAD-BEARING. An unannotated `export const SITE_MODE =
  // "light"` has the LITERAL type `"light"`, so `SITE_MODE === "dark"` in
  // `__root.tsx` is TS2367 — a comparison of two disjoint literal types — and
  // EVERY light build fails to typecheck. Measured; it is why the template
  // placeholder carries the annotation too.
  assert.match(server, /export const SITE_MODE: "light" \| "dark" = /);
  assert.match(brand, /export const SITE_MODE: "light" \| "dark" = /);
  // Reported back, so the caller can tell what it got rather than inferring it
  // from the absence of an error — the works-but-cannot-say-so shape.
  assert.match(server, /return \{ lang: langValue, mode: modeValue,/);
  assert.match(server, /writeSiteBrand\(\{[^)]*mode: payload\.mode/);
});

test("BOTH PUBLISH PATHS SEND IT — the cheap spine as well as the build", () => {
  // THE SPINE IS THE ONE THAT IS EASY TO MISS. Every text fix, colour change,
  // picture swap, logo change and version restore republishes through
  // `recompileAndPublish`, and the container writes `site-brand.ts` on EVERY
  // build — it must, or one site's mode leaks onto the next. So a path that
  // does not send the stored value sends nothing, and nothing is light: a
  // customer's typo fix would silently put their dark site back to white.
  // DERIVED FROM `lang`, NOT A LIST OF THE THREE HOPS THERE ARE TODAY. The two
  // travel together by construction — both come off the same stored look, both
  // are baked into `site-brand.ts` by the same function, and both are lost the
  // same way — so "everywhere one goes, the other goes" is the property, and a
  // fourth hop written tomorrow is covered without anybody remembering this
  // test. A hand-written count of the sites is what leaves the next one bare.
  const hops = [...worker.matchAll(/^(\s*)lang: ([^,\n]+),$/gm)];
  assert.ok(hops.length >= 3, "the scan found only " + hops.length + " lang hops, so it has stopped scanning");
  for (const m of hops) {
    // The next non-comment property after it. Comments are skipped rather than
    // counted, because this repo puts its reasoning between the two lines.
    const after = worker.slice(m.index + m[0].length, m.index + m[0].length + 1200);
    const next = after.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))[0] || "";
    assert.ok(/^mode:/.test(next), "a `lang` hop with no `mode` beside it: " + m[2] + " → " + next.slice(0, 80));
  }
  // And the third hop is a function SIGNATURE, so the value has somewhere to
  // land — a caller passing `mode` to a destructure that does not name it is a
  // silent drop.
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*\bmode\b[^}]*\}\)/);
});

test("A REVISE THAT DOES NOT MENTION IT KEEPS IT", () => {
  // `EDIT_FIELDS` is what makes "absent means unchanged" true of a field
  // without a second rule anywhere. Off that list, `mergeLook` never emits it,
  // `look.mode` is permanently undefined, and every revise of a dark site
  // publishes it light.
  assert.ok(EDIT_FIELDS.includes("mode"), EDIT_FIELDS.join(","));
  // AND IT IS NOT A LAYOUT DECISION. The look lane escalates `family` and
  // `structure` to a full page rewrite because the container never sees them;
  // it DOES see this one, so escalating would spend ~27 credits to reach the
  // same recompile.
  assert.match(worker, /const needsPages = moved\.filter\(\(k\) => k === "family" \|\| k === "structure"\)/);
});

test("the designer can name it, from a closed set", () => {
  // A cap the model is merely told about is not a cap — the `MAX_CLARIFY`
  // lesson. `enum` is what makes an unrecognised answer impossible rather than
  // merely unlikely, and `normalizeMode` is the belt behind it.
  const field = worker.slice(worker.indexOf("      mode: {"), worker.indexOf("      needsWeb: {"));
  assert.ok(field.length > 100 && field.length < 2000, "the mode field window is " + field.length + " bytes");
  assert.match(field, /enum: \["light", "dark"\]/);
  // OPTIONAL AND LEFT OUT BY DEFAULT. Every business is light unless it says
  // otherwise, and a required field is one the model must answer — which is
  // what moves a value nobody asked to move.
  assert.match(field, /LEAVE THIS OUT/);
  // AND IT SAYS NOT TO ALSO SEND TOKENS. Without this the model reaches for the
  // approximation it has always reached for, and a token patch fights the
  // theme's own dark palette on exactly the site that needed neither.
  assert.match(field, /do not also send tokens/i);
});

test("the router sends a dark ask to the cheap lane, and the reply names it", () => {
  // NAMED IN THE `look` CLAUSE, or the router has no reason to route it there
  // and "make the whole site dark" escalates to a full rebuild that produces
  // the same recompile for ~27 credits.
  const ask = read("../builder/site-ask.mjs");
  const look = ask.slice(ask.indexOf('"\\"look\\" —'), ask.indexOf('"\\"rules\\" —'));
  assert.ok(look.length > 200, "the look clause window is " + look.length + " bytes");
  assert.match(look, /DARK MODE IS THIS LAYER TOO/);
  // AND THE CUSTOMER IS TOLD IN WORDS. `moved` is a list of field names the
  // client maps through `SAY`; without an entry the reply reads "Updated the
  // look — mode." about a change to whether their whole site is black.
  assert.match(chat, /const SAY = \{[^}]*\bmode:\s*'[^']+'/);
});
