import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Divide, answering 0 rather than NaN or Infinity.
 *
 * ZERO IS THE ORDINARY DENOMINATOR HERE. A limit nobody has set, a total of an
 * empty basket, a threshold on a plan with no cap, a max rating of 0 — every
 * one of these is a fresh site rather than a strange input. Divided anyway,
 * `0 / 0` is NaN and `1 / 0` is Infinity, and BOTH survive `Math.min` and
 * `Math.max` untouched: `Math.min(100, NaN)` is NaN. So the guards that look
 * like they clamp the result do not.
 *
 * Measured by rendering the whole kit with every number set to 0: fourteen
 * components put NaN or Infinity into the page, ten of them inside a `style`
 * attribute — `width: NaN%` on a progress bar, which the browser drops, so the
 * bar silently renders empty rather than looking broken.
 */
export function divide(numerator: number, denominator: number): number {
  const out = numerator / denominator;
  return Number.isFinite(out) ? out : 0;
}

/**
 * Parse a date value, treating a bare `YYYY-MM-DD` as LOCAL midnight.
 *
 * A DATE-ONLY STRING IS UTC MIDNIGHT BY SPEC, and every component then reads it
 * back with local getters — `getDate()`, `toLocaleDateString()`. West of
 * Greenwich that is the PREVIOUS DAY: measured in New York, `2026-03-04`
 * rendered as March 3, and `date-badge` put that wrong day in its `dateTime`
 * too, which is the half a crawler reads. A Postgres `date` column holds
 * exactly this shape, so it is the ordinary input rather than a strange one.
 *
 * IT ONLY TOUCHES THAT ONE SHAPE. A full ISO timestamp carries its own zone and
 * is passed through untouched, as is a number and a `Date` — so routing every
 * parse through here cannot change a value that was already right.
 *
 * The bug is invisible in the UK, where the platform is, because UTC midnight
 * and local midnight are the same instant in winter and an hour apart in
 * summer — never a different day. That is why 78 call sites had it.
 */
export function toDate(value: string | number | Date): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  return new Date(value);
}

/**
 * Money held in MINOR units, formatted for the visitor's locale.
 *
 * THE DIVISOR IS NOT 100. Eighteen components wrote
 * `.format(m / 100)` with `currency` as a free-form prop, so every
 * zero-decimal currency displayed at a HUNDREDTH of its value — ¥1,200 as ¥12 —
 * and the three-decimal ones (KWD, BHD, OMR) at ten times. `site-payments.mjs`
 * records the same constant on the CHARGING path: "a hardcoded x100 charges a
 * hundred times the price". Intl already knows every currency's exponent, so it
 * is asked rather than tabulated, and nothing here needs maintaining when a
 * currency redenominates.
 *
 * AN UNKNOWN CODE MUST NOT TAKE THE PAGE DOWN. `Intl.NumberFormat` throws a
 * RangeError on anything that is not ISO 4217, and an uncaught throw in render
 * goes through the error boundary and blanks the whole page — over one typo in
 * a currency column. The fallback shows the number and the code, which is
 * wrong-looking and readable rather than correct-looking and absent.
 */
export function formatMinor(minor: number, currency = "GBP"): string {
  try {
    const nf = new Intl.NumberFormat(undefined, { style: "currency", currency });
    // `maximumFractionDigits` IS the currency's exponent: 0 for JPY, 2 for GBP,
    // 3 for KWD.
    const digits = nf.resolvedOptions().maximumFractionDigits ?? 2;
    return nf.format(minor / 10 ** digits);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/**
 * The scroll behaviour to ask for, honouring `prefers-reduced-motion`.
 *
 * A SCRIPTED SCROLL IGNORES THE MEDIA QUERY. CSS `scroll-behavior: smooth` is
 * overridden by the `motion-reduce` utilities the kit uses everywhere else, but
 * `el.scrollTo({ behavior: "smooth" })` is an explicit instruction from
 * JavaScript and nothing overrides it — so six components animated the viewport
 * for somebody who had asked the operating system not to. Vestibular disorders
 * are the reason that setting exists; a full-viewport slide is the exact motion
 * it is there to stop.
 *
 * Read at CALL TIME, not once at module load, so somebody changing the setting
 * does not have to reload the page. Returns "auto" where `matchMedia` is
 * missing is wrong — an absent API is not a stated preference — so it answers
 * "smooth" there, which is the behaviour that existed before this.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof matchMedia === "undefined") return "smooth";
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
