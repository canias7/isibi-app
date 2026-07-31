import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Padding that respects the notch, the home bar, and rounded corners.
 *
 * `env(safe-area-inset-*)` IS ADDITIVE HERE, NOT REPLACING — the padding
 * is `max(existing, inset)` via calc, so a bar that already pads 12px
 * keeps 12px on laptops and grows only where the hardware intrudes.
 * Replacing outright is the common bug: content glued to the screen edge
 * everywhere EXCEPT iPhones, instead of comfortable everywhere.
 *
 * Bottom-only by default, because the home-indicator overlap is the one
 * people actually hit (dock, snackbar, sticky CTAs — this kit's own
 * components each carry the fix; this wrapper is for everything else).
 * `sides` opts into the rest for true full-bleed layouts.
 *
 * Requires `viewport-fit=cover` in the meta viewport to do anything on
 * iOS — stated here because without it the insets are all zero and this
 * wrapper silently no-ops, which reads as "it works".
 */
export function SafeArea({ sides = ["bottom"], pad = "0px", children, className, as: Tag = "div" }: {
  sides?: ("top" | "bottom" | "left" | "right")[];
  /** Base padding kept on hardware with no insets. */
  pad?: string;
  children?: React.ReactNode;
  className?: string;
  as?: "div" | "footer" | "header" | "nav";
}) {
  const style: React.CSSProperties = {};
  for (const s of sides) {
    const key = ("padding" + s[0].toUpperCase() + s.slice(1)) as "paddingTop" | "paddingBottom" | "paddingLeft" | "paddingRight";
    style[key] = `max(${pad}, env(safe-area-inset-${s}))`;
  }
  return <Tag style={style} className={cn(className)}>{children}</Tag>;
}
