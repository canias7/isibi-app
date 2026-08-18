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

// ---------------------------------------------------------------------------
// SAME LOCALE, DIFFERENT ICU — the failure the pin above cannot reach.
//
// `pinSiteLocale` makes an ABSENT locale mean the site's, and deliberately
// leaves an explicit one alone. That is right, and it is not the whole story: a
// format can name one locale on both sides and still render different text,
// because the SERVER and the VISITOR are two different ICU builds.
//
// MEASURED, Node 22 (ICU 78.2) against this Chromium, same timezone:
//   Intl.DateTimeFormat("en-GB", {weekday:"short", day, month:"long", year})
//     node "Sat, 19 September 2026"   chrome "Sat 19 September 2026"
//   timeZoneName: "shortOffset" at ZERO offset
//     node "GMT+0"                    chrome "GMT"
//   timeZoneName: "longOffset" at ZERO offset
//     node "GMT+00:00"                chrome "GMT"
// One character each, and each one took a page down with React #418 ("text").
//
// IT CANNOT BE FIXED BY MATCHING ENGINES, which is the point. We SSR in workerd
// and hydrate in whatever browser the visitor brought — so a format whose output
// depends on the ICU version will mismatch for some fraction of real visitors
// however the build machine happens to be configured. The proof that agreement
// is luck: CI's Node and CI's Chromium DO agree on the date shape, so `family
// apps` was green on `entertainer /` while it failed here on the same commit.
//
// SCOPE, MEASURED RATHER THAN GENERALISED. 237 weekday/month/day/year
// combinations across en-GB, en-US and en: 12 differ and ALL TWELVE are en-GB
// with a weekday AND a day AND a month in one formatter. Across 16 locales
// (adding de, fr, es, pt, it, nl, pl, ja, zh, ar, tr, sv, cs) only en-GB
// diverges. en-GB is the platform's primary market, and `pinSiteLocale`
// resolves an absent locale to SITE_LANG — so a UK site puts every one of these
// call sites into the unstable region.
const KIT = new URL("../builder/lovable/template/src/components/ui/", import.meta.url);

// COMMENTS ARE BLANKED BEFORE ANYTHING HERE IS JUDGED, and it is not a
// precaution: the first draft of the TimezonePicker guard below failed against
// correct code, because `indexOf("resolvedOptions()")` found the sentence in the
// comment EXPLAINING the fix rather than the call, and that sentence sits above
// the effect it was asserting came first. Prose describing a bug contains the
// bug's spelling. The same trap would let a comment showing an example format
// count as a call.
//
// LENGTH-PRESERVING, so offsets stay valid against the real text — and by WHOLE
// LINE rather than from any `//`, which would eat the rest of a line holding a
// URL. Every comment in these files is a whole line or a block.
const blankComments = (src) => {
  const blanked = src.split("\n").map((line) => {
    const t = line.trim();
    return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") ? " ".repeat(line.length) : line;
  }).join("\n");
  if (blanked.length !== src.length) throw new Error("the comment blanker changed the file's length");
  return blanked;
};

// Balanced-brace argument slice. A flat split on "," cannot be used: a format's
// options are full of commas that belong to the object.
const argsAt = (src, open) => {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") { depth--; if (!depth) return src.slice(open + 1, i); }
  }
  return null;
};
const formatCalls = () => {
  const out = [];
  for (const name of fs.readdirSync(KIT)) {
    if (!name.endsWith(".tsx")) continue;
    const src = blankComments(fs.readFileSync(new URL(name, KIT), "utf8"));
    const re = /(Intl\.DateTimeFormat)\s*\(|\.(toLocaleDateString|toLocaleString|toLocaleTimeString)\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      const open = src.indexOf("(", m.index + (m[1] ? m[1].length : m[0].length - 1));
      const args = argsAt(src, open);
      if (args != null) out.push({ file: name, args: args.replace(/\s+/g, " ") });
    }
  }
  return out;
};

// THE SCAN'S OWN FLOOR. A regex that silently stops matching reports a clean kit,
// which is the most reassuring way to check nothing at all.
test("the format scan still finds the kit's formatting calls", () => {
  const calls = formatCalls();
  assert.ok(calls.length > 100, "the format scan found only " + calls.length + " calls — it has stopped matching");
  assert.ok(calls.some((c) => /weekday/.test(c.args)), "the scan sees no weekday option at all");
});

test("NO KIT COMPONENT ASKS ICU FOR AN OFFSET LITERAL", () => {
  // Unstable at ZERO offset in both the short and the long form, so asking for
  // the wider one is not the fix — measured, both diverge. There is no safe use:
  // "UTC" is in `timezone-picker`'s own default list, so every server-rendered
  // picker carried an option the browser then disagreed with.
  //
  // Compute it from NUMERIC parts and write the string yourself, which is what
  // `timezone-picker.tsx` does now — verified stable across UTC, London, Paris,
  // New York, Tokyo, Kolkata, Sydney and Chatham, including the half-hour and
  // 45-minute zones a naive hours-only formatter gets wrong.
  const bad = formatCalls().filter((c) => /timeZoneName\s*:\s*["'](short|long)Offset["']/.test(c.args));
  assert.deepEqual(bad.map((c) => c.file), [],
    "these ask ICU for an offset literal, which differs between engines at zero offset: " + bad.map((c) => c.file).join(", "));
});

// A RATCHET, NOT A CLEAN SHEET. Twelve components ask one formatter for a
// weekday, a day and a month together, which is the region measured above. They
// are recorded rather than fixed here: each needs its own decision about the
// separator, and none of them is what broke the family exemplars. The list is
// compared EXACTLY, so a thirteenth fails and a fixed one cannot sit here
// looking like debt that is still owed.
const WEEKDAY_DAY_MONTH = [
  "agenda-list.tsx", "approval-deadline.tsx", "delivery-estimate.tsx", "delivery-eta.tsx",
  "event-card.tsx", "event-meta.tsx", "meeting-papers.tsx", "multi-date-picker.tsx",
  "nl-date-input.tsx", "return-window.tsx", "site-diary.tsx", "week-strip.tsx",
];

test("the weekday+day+month family does not grow", () => {
  const hit = formatCalls().filter((c) =>
    /weekday\s*:/.test(c.args) && /\bday\s*:/.test(c.args) && /month\s*:/.test(c.args));
  const files = [...new Set(hit.map((c) => c.file))].sort();
  assert.deepEqual(files, [...WEEKDAY_DAY_MONTH].sort(),
    "the weekday+day+month set moved. On an en-GB site these render different text on the " +
    "server and in the browser. Compose the weekday yourself — two formatters and your own " +
    "separator — the way date-enquiry.tsx does, then take the file out of this list.");
});

test("date-enquiry composes the weekday itself", () => {
  // The fix that closed `entertainer /`. Asserted as the PROPERTY — two
  // formatters and a separator of ours — rather than the spelling, and paired
  // with the negative, since a single four-field formatter is what it replaced.
  const src = blankComments(fs.readFileSync(new URL("date-enquiry.tsx", KIT), "utf8"));
  const pretty = src.slice(src.indexOf("const pretty ="), src.indexOf("return (", src.indexOf("const pretty =")));
  assert.ok(pretty.length > 100, "the pretty() window is empty — the anchor moved");
  assert.equal((pretty.match(/new Intl\.DateTimeFormat/g) || []).length, 2,
    "pretty() no longer builds the date from two separate formatters");
  assert.ok(!/weekday[^}]*month:\s*"long"/.test(pretty),
    "pretty() asks one formatter for the weekday and a long month again — that literal differs between engines");
});

test("Countdown never reads the clock on its first render", () => {
  // The fix that closed `festival /` and `box-office /event`. The server cannot
  // know this number, so seeding state from `Date.now()` guaranteed a mismatch
  // as soon as the SSR-to-hydration gap crossed a second — a race in the
  // harness and, at network latency, the ordinary case in production.
  const src = blankComments(fs.readFileSync(new URL("countdown.tsx", KIT), "utf8"));
  const init = src.slice(src.indexOf("React.useState"), src.indexOf("\n", src.indexOf("React.useState")));
  assert.ok(init.length > 10, "the useState window is empty — the anchor moved");
  assert.ok(!/Date\.now\(\)/.test(init),
    "Countdown seeds its state from the clock again — the server and the browser will disagree");
  assert.match(src, /React\.useEffect/, "Countdown no longer fills the value in after mount");
});

test("TimezonePicker does not guess the visitor's zone during SSR", () => {
  // `resolvedOptions().timeZone` answers with the RUNTIME's zone, so the server
  // and the visitor built option lists of different lengths with different first
  // entries — a structural mismatch rather than a cosmetic one, for every
  // visitor outside the server's zone.
  const src = blankComments(fs.readFileSync(new URL("timezone-picker.tsx", KIT), "utf8"));
  const guessAt = src.indexOf("resolvedOptions()");
  assert.ok(guessAt > 0, "the zone guess is gone — this guard no longer describes the file");
  const effectAt = src.indexOf("React.useEffect");
  assert.ok(effectAt > 0 && effectAt < guessAt,
    "the visitor's zone is guessed during render again, not after mount");
});
