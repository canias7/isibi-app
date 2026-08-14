"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
/**
 * TWO THINGS WERE WRONG HERE AND THE SECOND IS ON EVERY BAR IN THE KIT.
 *
 * `value` was destructured out and used ONLY in the transform — it never
 * reached `ProgressPrimitive.Root`, so Radix had nothing to describe and
 * rendered `data-state="indeterminate"` with NO `aria-valuenow`, for every
 * value. Measured: 47, 0 and 100 all came out identical to the assistive
 * layer. So `role="progressbar"` announced "busy" and refused to say how far —
 * on an upload dialog, a storage meter and a wizard's step counter, which are
 * exactly the three places somebody needs the number. It also meant any CSS
 * keyed on `[data-state]` could never fire.
 *
 * And the value was passed through UNCLAMPED into a CSS length. Ten callers
 * compute it, each guarding differently — one `Math.min(100, …)` (top only),
 * one `Math.max(0, Math.min(100, …))` (both, but NaN walks through), one
 * `|| 1` on the divisor, and several none at all. `multi-step-form` handed it
 * `(current + 1) / steps.length * 100`, which is `Infinity` on the empty array
 * every list starts as — `translateX(--Infinity%)` is invalid CSS, the browser
 * drops the declaration, and the indicator keeps its `w-full` default: a bar
 * reading 100% COMPLETE for a form with no steps in it.
 *
 * Clamped here rather than at the ten call sites, for the reason `safe-image`
 * exists: a guard the caller must remember is one a caller will eventually
 * forget, and the page that forgets is the one nobody looks at.
 */
>(({ className, value, max = 100, ...props }, ref) => {
  const top = typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 100;
  // `null`, never 0, when the number is unreadable — that is Radix's own word
  // for "indeterminate", and reporting an unknown as 0% is a claim.
  const v = typeof value === "number" && Number.isFinite(value)
    ? Math.min(top, Math.max(0, value))
    : null;
  const pct = v === null ? 0 : (v / top) * 100;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={v}
      max={top}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
