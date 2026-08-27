import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A development-time overlay numbering the page's tab order.
 *
 * THIS IS A BUILD TOOL, NOT A SHIPPING FEATURE, and it says so — it exists
 * because the tab order is invisible until somebody tabs, and the bugs
 * (a modal reachable behind its scrim, a visually-first button that is
 * focus-last) are cheap to see with numbers painted on and expensive to find
 * by tabbing forty times.
 *
 * IT NUMBERS WHAT IS ACTUALLY FOCUSABLE — the real matcher: visible, not
 * disabled, tabindex >= 0 — rather than what looks interactive. The
 * difference between those two sets IS the bug list.
 *
 * POSITIVE `tabindex` VALUES ARE FLAGGED LOUDLY. They hijack the order ahead
 * of everything and are almost always a mistake; finding one is usually the
 * whole audit.
 *
 * The overlay is `aria-hidden` and pointer-transparent — it must not change
 * the thing it measures.
 */
export function TabOrderNote({ active, className }: { active: boolean; className?: string }) {
  const [spots, setSpots] = React.useState<{ x: number; y: number; n: number; positive: boolean }[]>([]);

  React.useEffect(() => {
    if (!active) { setSpots([]); return; }
    const els = Array.from(document.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]'))
      .filter((el) => {
        if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    // Positive tabindex jumps the queue; document order for the rest.
    const positive = els.filter((e) => e.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
    const normal = els.filter((e) => e.tabIndex === 0);
    setSpots([...positive, ...normal].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, n: i + 1, positive: el.tabIndex > 0 };
    }));
  }, [active]);

  if (!active) return null;
  return (
    <div data-slot="tab-order-note" aria-hidden className={cn("pointer-events-none absolute inset-0 z-50", className)}>
      {spots.map((s) => (
        <span key={s.n}
          style={{ left: s.x, top: s.y }}
          className={cn("absolute -translate-x-1 -translate-y-1 rounded px-1 text-[10px] font-bold tabular-nums",
            s.positive
              ? "bg-foreground text-background ring-2 ring-foreground ring-offset-1"
              : "bg-background text-foreground shadow ring-1 ring-border")}>
          {s.n}{s.positive ? "!" : ""}
        </span>
      ))}
    </div>
  );
}
