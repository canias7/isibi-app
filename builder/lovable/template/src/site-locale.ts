// THE SITE'S LOCALE, NOT THE READER'S — and this file exists because it has to
// be structural rather than a rule anybody remembers.
//
// MEASURED, on the real kit: 436 calls across 229 of its files use
// `toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` with NO
// locale argument, which is precisely a request to format differently for every
// visitor. Under the old design that was harmless — the server render was a
// throwaway snapshot React discarded on mount — and under TanStack Start the
// browser HYDRATES it, so each one becomes a live mismatch.
//
// The exposure, driven in a real browser against an `en-US` server:
//   visitor en-GB   3/4 sampled formats differ   "9/19/2026" → "19/09/2026"
//   visitor de-DE   4/4                          "1,234,567.5" → "1.234.567,5"
//   visitor fr-FR   4/4                          → "samedi 19 septembre 2026"
//   visitor ja-JP   3/4                          → "2026年9月19日土曜日"
// en-GB is the platform's primary market, so this is the ordinary case rather
// than an edge one.
//
// WHY A PROTOTYPE PATCH RATHER THAN 436 EDITS. Editing the call sites fixes the
// kit as it stands today and does NOT hold: the generator writes new pages, and
// `toLocaleString()` is what training data reaches for, so it returns on every
// site built afterwards. That is the `safe-image` argument — a rule the model
// must remember is one it eventually forgets — applied to formatting. One
// module covers the kit AND everything written against it later.
//
// IT IS ALSO BETTER PRODUCT BEHAVIOUR, which is worth saying because it looks
// like a workaround. A barber shop in Leeds should show an American visitor
// `19 September 2026`, not `9/19/2026`: the site belongs to the business, and
// its dates and prices are the business's, not the reader's.
//
// MUTATING A GLOBAL IS SAFE HERE FOR THE SAME REASON `site-runtime.ts` may hold
// module state: ONE DISPATCH SCRIPT SERVES EXACTLY ONE SITE, so there is never a
// second site's locale in the isolate to confuse it with — and in a browser the
// page belongs to the visitor already. Written down because the pattern reads
// dangerous and the reason it is not is a property of the deployment.
import { SITE_LANG } from "./site-brand";

type Formatter = (this: unknown, locales?: unknown, options?: unknown) => string;

// PATCHED ONCE, EVER. `checkRender` imports a built server bundle into the build
// service's own Node process, and the container is long-lived — so without this
// each build would wrap the previous build's wrapper and the chain would grow
// for the life of the container.
const MARK = "__siteLocalePinned";

/**
 * Make an absent locale mean THIS SITE's, on both sides of the render.
 *
 * An EXPLICIT locale still wins, untouched: a page that deliberately formats a
 * price in `de-DE` is making a decision, and this is only about the calls that
 * made none. Asserted, because silently overriding a stated locale would be a
 * worse bug than the one being fixed.
 */
export function pinSiteLocale(locale: string = SITE_LANG): void {
  const g = globalThis as Record<string, unknown>;
  if (g[MARK]) return;
  g[MARK] = locale;

  const wrap = (proto: object, name: string) => {
    const orig = (proto as Record<string, unknown>)[name] as Formatter | undefined;
    if (typeof orig !== "function") return;
    (proto as Record<string, unknown>)[name] = function (this: unknown, locales?: unknown, options?: unknown) {
      return orig.call(this, locales === undefined ? locale : locales, options);
    };
  };

  for (const name of ["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]) {
    wrap(Date.prototype, name);
  }
  // `toLocaleString()` ON A NUMBER IS THE QUIET ONE. It is 365 of the 436 calls
  // and it decides the thousands separator and the decimal mark — `1,234.5`
  // against `1.234,5` — so a price list mismatches for every visitor in half of
  // Europe while every date on the page happens to agree.
  wrap(Number.prototype, "toLocaleString");
  wrap(BigInt.prototype, "toLocaleString");

  // AND THE CONSTRUCTORS, which the prototype patch cannot reach: 19 kit call
  // sites build `new Intl.DateTimeFormat(undefined, …)` directly, and those
  // resolve the runtime's default exactly as the methods above did.
  for (const name of ["DateTimeFormat", "NumberFormat", "ListFormat", "PluralRules", "RelativeTimeFormat", "Collator"]) {
    const Ctor = (Intl as unknown as Record<string, unknown>)[name] as
      | (new (locales?: unknown, options?: unknown) => unknown)
      | undefined;
    if (typeof Ctor !== "function") continue;
    const Patched = function (this: unknown, locales?: unknown, options?: unknown) {
      return new (Ctor as new (l?: unknown, o?: unknown) => object)(
        locales === undefined ? locale : locales,
        options,
      );
    } as unknown as Record<string, unknown>;
    // `Intl.DateTimeFormat.supportedLocalesOf` and friends are real API a caller
    // may use, and `prototype` has to survive or `instanceof` stops working.
    Object.setPrototypeOf(Patched, Ctor);
    Patched.prototype = (Ctor as unknown as { prototype: unknown }).prototype;
    (Intl as unknown as Record<string, unknown>)[name] = Patched;
  }
}
