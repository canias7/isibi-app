import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The button that appears once you are a long way down.
 *
 * IT MOVES FOCUS, NOT JUST THE SCROLL POSITION. A back-to-top that only scrolls
 * leaves a keyboard user's focus at the bottom of the page, so their next Tab
 * jumps them straight back down — which makes the button worse than useless for
 * exactly the people who most need a shortcut.
 *
 * IT HONOURS `prefers-reduced-motion`: smooth scrolling a whole page is a
 * genuine trigger for motion sickness, and this is one of the longest animations
 * a site performs.
 *
 * It appears only past a threshold, because a permanent floating button covers
 * content at the top of a page where it can do nothing.
 */
export function BackToTop({ showAfter = 600, targetId, label = "Back to top", className }: {
  /** Pixels scrolled before it appears. */
  showAfter?: number;
  /** Element to focus — usually the main heading or a skip target. */
  targetId?: string;
  label?: string;
  className?: string;
}) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    const check = () => setShow(window.scrollY > showAfter);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [showAfter]);
  if (!show) return null;
  return (
    <button data-slot="back-to-top" type="button"
      onClick={() => {
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        const el = targetId ? document.getElementById(targetId) : null;
        if (el) { el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); }
      }}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm shadow-xs hover:bg-muted", className)}>
      <ArrowUp aria-hidden className="size-3.5" />{label}
    </button>
  );
}
