// THE SITE'S LOCALE, NOT THE READER'S.
//
// 436 calls across 229 kit files format with no locale argument, which is a
// request to differ per visitor. Harmless while the server render was a
// throwaway snapshot; a live hydration mismatch now that the browser hydrates
// it. Measured against an `en-US` server before the fix: en-GB 3/4 sampled
// formats differed, de-DE and fr-FR 4/4.
//
// WHAT THIS FILE CAN AND CANNOT HOLD. The module is TypeScript inside the
// template and cannot be imported here, so the BEHAVIOUR is proved by driving a
// real browser at five visitor locales against a real build — every one renders
// what the server rendered. What a unit test can hold is the WIRING, which is
// where this dies silently: the pin applied too late reads exactly like the pin
// working, until somebody in Germany loads the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const T = new URL("../builder/lovable/template/src/", import.meta.url);
const ROUTER = fs.readFileSync(new URL("router.tsx", T), "utf8");
const LOCALE = fs.readFileSync(new URL("site-locale.ts", T), "utf8");

test("THE PIN IS APPLIED BEFORE THE ROUTE TREE IS IMPORTED", () => {
  // THE ORDER IS THE WIRING. `routeTree.gen` pulls in every page module, so an
  // import below it lets a page that formats at module scope evaluate against
  // the runtime's own locale on the server and the visitor's in the browser —
  // the exact mismatch this removes, surviving the fix.
  const pin = ROUTER.indexOf('from "./site-locale"');
  const tree = ROUTER.indexOf('from "./routeTree.gen"');
  assert.ok(pin > 0, "the router no longer imports the locale pin");
  assert.ok(tree > 0, "the route-tree import moved — rescope this");
  assert.ok(pin < tree, "the pin is imported after the route tree — a page formatting at module scope escapes it");
  // AND IT IS CALLED, not merely imported. An import with no call is the
  // dead-wiring shape this repo has recorded a dozen times, and here it would
  // leave every date on every site mismatching with nothing to point at.
  assert.match(ROUTER, /^pinSiteLocale\(\);$/m, "the pin is imported and never called");
});

test("router.tsx is the ONE place both sides go through", () => {
  // Start calls `getRouter()` from `createStartHandler` on the server and from
  // `hydrateStart` in the browser, so a single import covers the render and the
  // hydration and the two cannot disagree by construction. Pinning in
  // `server.ts` instead would cover the server only — and the client half is the
  // half that mismatches.
  assert.match(ROUTER, /export function getRouter\(\)/,
    "getRouter is gone — the pin no longer sits on the path both sides take");
});

test("AN EXPLICIT LOCALE STILL WINS", () => {
  // A page deliberately formatting a price in `de-DE` has made a decision; this
  // is only about the calls that made none. Silently overriding a stated locale
  // would be a worse bug than the one being fixed — and it is the shape a
  // careless implementation takes, since forcing the argument is simpler than
  // defaulting it.
  assert.match(LOCALE, /locales === undefined \? locale : locales/,
    "the pin overrides a locale the caller stated, rather than supplying a missing one");
  assert.ok(!/orig\.call\(this, locale,/.test(LOCALE),
    "the pin forces its own locale unconditionally");
});

test("it patches ONCE, however many times a bundle is imported", () => {
  // `checkRender` imports a built server bundle into the build service's own
  // long-lived Node process, so without a guard each build would wrap the
  // previous build's wrapper and the chain would grow for the life of the
  // container — a slow leak nothing would ever attribute to this file.
  assert.match(LOCALE, /if \(g\[MARK\]\) return;/, "the pin can be applied twice, stacking wrappers");
});

test("the three method families AND the constructors are covered", () => {
  // DERIVED FROM WHAT THE KIT ACTUALLY CALLS rather than a list somebody
  // remembered. `Number.prototype.toLocaleString` is the quiet one — 365 of the
  // 436 calls — and it decides the thousands separator and the decimal mark, so
  // missing it mismatches every price list in half of Europe while every date on
  // the page happens to agree.
  for (const m of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    assert.ok(LOCALE.includes(m), "the pin does not cover " + m);
  }
  assert.match(LOCALE, /wrap\(Number\.prototype, "toLocaleString"\)/,
    "numbers are unpinned — a price list mismatches wherever the decimal mark differs");
  // The prototype patch cannot reach a constructor, and the kit builds
  // `new Intl.DateTimeFormat(undefined, …)` directly in 19 places.
  for (const c of ["DateTimeFormat", "NumberFormat", "ListFormat", "PluralRules"]) {
    assert.ok(LOCALE.includes(c), "Intl." + c + " is not pinned");
  }
  // `instanceof` and `supportedLocalesOf` are real API a caller may use, so the
  // replacement has to keep the original's prototype chain.
  assert.match(LOCALE, /Object\.setPrototypeOf\(Patched, Ctor\)/,
    "the patched constructor loses the original's statics — supportedLocalesOf disappears");
  assert.match(LOCALE, /Patched\.prototype = /, "the patched constructor breaks instanceof");
});

test("THE SITE'S OWN LANGUAGE IS WHAT IT USES", () => {
  // Not a constant, and not the runtime's default: `SITE_LANG` is what the
  // designer declared and what `<html lang>` says, so the document and its
  // formatting cannot disagree about which language the site is in.
  //
  // This makes the `lang` field load-bearing in a way it was not — it decided an
  // attribute before and decides every date, time and price now. A UK business
  // declaring bare `en` gets US formatting.
  assert.match(LOCALE, /import \{ SITE_LANG \} from "\.\/site-brand"/,
    "the pin no longer takes the site's own declared language");
  assert.match(LOCALE, /locale: string = SITE_LANG/, "SITE_LANG is imported and not used as the default");
});
