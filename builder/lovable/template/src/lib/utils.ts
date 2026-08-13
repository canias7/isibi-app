import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
