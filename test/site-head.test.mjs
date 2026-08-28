// The head-tag pack (2026-08-28, owner's call: "ok do that") — the tags every
// site on the open web carries and every site here was missing: a canonical
// address, `og:site_name`, `og:locale` (+ alternates), the composed card's
// pinned dimensions, the mobile browser's `theme-color`, and a real
// `apple-touch-icon.png` rasterised from the tab's own mark.
//
// Everything here is a SOURCE-READ, because both halves live in files the unit
// suite cannot execute: `__root.tsx` is template TypeScript rendered by Start,
// and `build-server.mjs` starts an HTTP server on import. The executed proof is
// `site-build`'s legs against the real container; these hold the properties
// between runs.

import { test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

const root = fs.readFileSync(new URL("../builder/lovable/template/src/routes/__root.tsx", import.meta.url), "utf8");
const brand = fs.readFileSync(new URL("../builder/lovable/template/src/site-brand.ts", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");

// Comments in all three files spell the tags being asserted (the prose-
// contains-the-spelling trap, nine-plus recorded instances), so every scan
// runs over a length-preserving blank of the whole-line comments.
const blank = (src) => src.replace(/^\s*(?:\/\/|#)[^\n]*$/gm, (m) => " ".repeat(m.length));

/** A window from a landmark to another landmark — never a byte count. */
function windowOf(src, from, to) {
  const a = src.indexOf(from);
  assert.ok(a >= 0, "anchor missing: " + from);
  const b = src.indexOf(to, a);
  assert.ok(b > a, "closing landmark missing: " + to);
  return src.slice(a, b);
}

/* ── the template: what the document says ────────────────────────────────── */

test("og:site_name is the business's name — the line above the card that otherwise shows the raw hostname", () => {
  const r = blank(root);
  assert.match(r, /property: "og:site_name", content: SITE_NAME/,
    "og:site_name is gone, or names something other than the business");
});

test("canonical and og:url speak from ONE expression, so they can never disagree about the real address", () => {
  const r = blank(root);
  // Exactly one place computes origin + path. A second copy is the two-readings
  // bug: the day one gains a trailing slash or drops the origin gate, a page
  // declares one address to crawlers and a different one to unfurlers.
  assert.equal((r.match(/m\.origin \+ here/g) || []).length, 1,
    "the page address is computed in more than one place — canonical and og:url can now disagree");
  // Both consumers read the shared `page`, and both are GATED on it: with no
  // origin in the sidecar there is NO tag, because a wrong canonical is worse
  // than none — it hands the ranking to an address that is not the site's.
  assert.match(r, /if \(page\) tags\.push\(\{ property: "og:url", content: page \}\)/,
    "og:url is ungated or reads something other than the shared address");
  assert.match(r, /\.\.\.\(page \? \[\{ rel: "canonical", href: page \}\] : \[\]\)/,
    "the canonical link is ungated or reads something other than the shared address");
});

test("theme-color is emitted only when the build baked one, from SITE_THEME_COLOR", () => {
  const r = blank(root);
  assert.match(r, /if \(SITE_THEME_COLOR\) tags\.push\(\{ name: "theme-color", content: SITE_THEME_COLOR \}\)/,
    "theme-color is ungated — the template's own empty string would render content=\"\"");
});

test("the apple-touch-icon link is gated on the build having rasterised one", () => {
  const r = blank(root);
  // A link to a file that was never made is a 404 on every page — the gate IS
  // the contract with `touchValue` in the container.
  assert.match(r, /\.\.\.\(SITE_TOUCH_ICON \? \[\{ rel: "apple-touch-icon", href: SITE_TOUCH_ICON \}\] : \[\]\)/,
    "the touch link is ungated, or points somewhere other than the baked path");
});

test("og:locale speaks OG's underscore spelling, and a bilingual site declares the other half as an alternate", () => {
  const r = blank(root);
  assert.match(r, /property: "og:locale", content: SITE_LANG\.replace\(\/-\/g, "_"\)/,
    "og:locale is gone or not derived from the site's own language");
  // The alternates come from SITE_LANGS — which includes the PRIMARY (that is
  // what lets the switcher offer the way back), so the loop must exclude it or
  // every bilingual site declares its own locale as its own alternate.
  const loop = windowOf(r, "for (const l of SITE_LANGS)", "}\n");
  assert.match(loop, /l\.lang !== SITE_LANG/,
    "the alternate loop does not exclude the primary — a site declares itself as its own alternate");
  assert.match(loop, /og:locale:alternate/, "the loop pushes something other than the alternate tag");
});

test("og:image dimensions are claimed ONLY for the composed card, whose size is pinned platform-wide", () => {
  const r = blank(root);
  const img = windowOf(r, "if (m?.image) {", "} else {");
  // The card is 1200×630 by construction; an owner upload's dimensions are
  // whatever they uploaded, and a wrong claim is worse than none — some
  // unfurlers crop to the declared box.
  const gate = img.indexOf("/\\/card\\.png$/.test(m.image)");
  const width = img.indexOf('og:image:width');
  const height = img.indexOf('og:image:height');
  assert.ok(gate >= 0, "the card gate is gone — dimensions are now claimed for owner uploads too");
  assert.ok(width > gate && height > gate, "the dimensions are pushed outside the card gate");
  assert.match(img, /content: "1200"/, "the claimed width is not the card's pinned width");
  assert.match(img, /content: "630"/, "the claimed height is not the card's pinned height");
  // The alt rides INSIDE the image block — an og:image:alt with no og:image is
  // a claim about nothing — and says the one thing the card always shows.
  assert.match(img, /property: "og:image:alt", content: SITE_NAME/,
    "og:image:alt is gone from the image block");
});

test("the template's own placeholders are EMPTY and annotated, so a standalone build emits neither tag", () => {
  const b = blank(brand);
  // Empty is the gate's off state; annotated `: string` for the SITE_MODE
  // lesson — an unannotated const has the LITERAL type of its value, and the
  // generated file writing a real colour would stop agreeing with this one.
  assert.match(b, /export const SITE_THEME_COLOR: string = "";/,
    "the template claims a tint of its own, or lost the annotation");
  assert.match(b, /export const SITE_TOUCH_ICON: string = "";/,
    "the template claims a touch icon of its own, or lost the annotation");
});

/* ── the container: what a build bakes ───────────────────────────────────── */

test("the baked tint is the SAME reading the share card paints with, and can never throw a build", () => {
  const s = blank(server);
  const w = windowOf(s, "let themeColorValue = ", 'const touchValue = ');
  // cardColors(resolveTheme(theme), tokens).paper — one reading for the
  // browser bar and the card, so they cannot name two different papers.
  assert.match(w, /cardColors\(resolveTheme\(theme\), tokens\)\.paper/,
    "the tint is derived somewhere other than the card's own reading");
  assert.match(w, /try \{/, "the tint derivation has no try — an unreadable theme fails the build over a tint");
  assert.ok(!/\bthrow\b/.test(w), "the tint derivation rethrows");
});

test("a touch icon exists only when THIS build wrote a local mark — never for an owner's remote icon", () => {
  const s = blank(server);
  // `icon && !iconOk`: the drawn favicon or the initials, both written to this
  // build's own public/icon.svg. An owner-uploaded icon is a remote file the
  // rasterise step has no bytes for — baking the path anyway would 404.
  assert.match(s, /const touchValue = icon && !iconOk \? "\/apple-touch-icon\.png" : "";/,
    "the touch gate widened — a build with an owner's remote icon now links a file it cannot make");
  // Both constants reach the generated file, stringified.
  assert.match(s, /"export const SITE_THEME_COLOR: string = " \+ JSON\.stringify\(themeColorValue\)/,
    "the tint never reaches the generated module");
  assert.match(s, /"export const SITE_TOUCH_ICON: string = " \+ JSON\.stringify\(touchValue\)/,
    "the touch path never reaches the generated module");
  // And the report carries the decision, for the rasterise gate downstream.
  assert.match(s, /touch: !!touchValue,/, "writeSiteBrand does not report the touch decision");
});

test("the rasterise reads the mark out of THIS build's dist, paints it on the theme's paper, and reports only once the bytes are down", () => {
  const s = blank(server);
  const w = windowOf(s, "let touchMade = false;", "const dist = collectDist(CLIENT_DIST);");
  // Gated on the SAME decision that baked the link — the two halves of one
  // contract. brandUsed.touch false must mean no link AND no rasterise.
  assert.match(w, /if \(brandUsed\.touch && fs\.existsSync\(touchSvgPath\)\)/,
    "the rasterise is not gated on the baked decision");
  // Out of dist/client (wiped per build), never public/ — `icon.svg` being
  // there means THIS build wrote it, the wordmark's rule.
  assert.match(w, /path\.join\(CLIENT_DIST, "icon\.svg"\)/,
    "the mark is read from somewhere a previous build could have written");
  // Over the theme's paper — a transparent mark composited onto nothing is a
  // BLACK square on iOS — from the card's own reading again.
  assert.match(w, /cardColors\(resolveTheme\(payload\.theme\), payload\.tokens\)\.paper/,
    "the icon is rasterised over nothing — a transparent mark becomes a black square");
  assert.match(w, /await screenshotHtml\(html, \{ width: 180, height: 180 \}\)/,
    "the icon is not rasterised at the touch size");
  // Written where collectDist publishes it — the card's leak-proofing by
  // address: the per-build DIST wipe makes a cross-build leak impossible.
  const wrote = w.indexOf('path.join(CLIENT_DIST, "apple-touch-icon.png")');
  assert.ok(wrote >= 0, "the icon is not written where collectDist can publish it");
  // Reported AFTER the write — the assignment, not the `let` declaration (the
  // repo's most-recorded own-goal): set any earlier and a failed write reports
  // an icon on a site whose link 404s.
  const made = w.indexOf("touchMade = true;");
  assert.ok(made > wrote, "the icon is reported before the bytes are down");
  // Best-effort: the catch logs and never rethrows — a site whose data layer
  // is live must not be lost over a home-screen icon.
  const catchAt = w.indexOf("} catch (e) {");
  assert.ok(catchAt > 0, "the rasterise has no catch — a browser failure fails the build");
  assert.ok(!/\bthrow\b/.test(w.slice(catchAt)), "the rasterise catch rethrows");
  // And the response says whether it happened — a silent failure reads exactly
  // like the feature switched off.
  assert.match(s, /touchIcon: touchMade,/, "the response does not carry the touch verdict");
});
