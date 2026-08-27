import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * List items that fade in one after another.
 *
 * THE STAGGER IS CAPPED. At 50ms each, the twentieth item appears a second
 * after the first and the fortieth after two — so a long list animates in more
 * slowly than it loads, which is the effect actively making the page worse.
 * Past the cap, everything lands together.
 *
 * The items are VISIBLE by default and the animation is additive. Building it
 * the other way — start at `opacity-0`, animate to visible — means a browser
 * that never runs the animation shows a permanently invisible list. That is not
 * hypothetical: it is what happens with reduced motion, with a failed
 * stylesheet, and in a print stylesheet.
 *
 * `prefers-reduced-motion` renders everything at once with no delay.
 *
 * It animates ONCE, on mount. Re-running on every render means a list that
 * re-animates whenever a filter changes, which is where a nice effect turns
 * into an irritation.
 */
export function StaggerList({ children, step = 50, maxDelay = 400, className }: {
  children: React.ReactNode;
  step?: number;
  maxDelay?: number;
  className?: string;
}) {
  return (
    <div data-slot="stagger-list" className={cn("contents", className)}>
      {React.Children.map(children, (child, i) => (
        <div
          style={{ animationDelay: `${Math.min(i * step, maxDelay)}ms` }}
          // Visible by default; the animation only adds a fade-in on top.
          className="motion-safe:animate-[stagger-in_320ms_ease-out_backwards]"
        >
          {child}
        </div>
      ))}
      <style>{`@keyframes stagger-in {
        from { opacity: 0; transform: translateY(4px) }
        to { opacity: 1; transform: none }
      }`}</style>
    </div>
  );
}
