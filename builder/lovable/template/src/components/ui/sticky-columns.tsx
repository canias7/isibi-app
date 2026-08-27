import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Two columns; the shorter one sticks while the taller scrolls.
 *
 * `self-start` IS THE WHOLE COMPONENT. Grid stretches items to the
 * tallest by default, and a stretched column is as tall as its track —
 * so `sticky top` inside it has nowhere to travel and silently does
 * nothing. The classic "why won't my sidebar stick" is this one line,
 * and it fails without an error, which is why the fix ships as a
 * component instead of a tip.
 *
 * Both sides MAY stick (docs TOC left, code right); each gets
 * `self-start sticky` with a shared top offset prop.
 */
export function StickyColumns({ left, right, top = "1rem", leftWidth = "240px", className }: {
  left: React.ReactNode;
  right: React.ReactNode;
  top?: string;
  leftWidth?: string;
  className?: string;
}) {
  return (
    <div data-slot="sticky-columns" style={{ ["--left" as string]: leftWidth }}
      className={cn("grid items-start gap-6 lg:[grid-template-columns:var(--left)_minmax(0,1fr)]", className)}>
      <div style={{ top }} className="lg:sticky lg:self-start">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}
