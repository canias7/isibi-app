import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Previous and next section, at the foot of a long page.
 *
 * BOTH LINKS NAME THEIR DESTINATION. "Previous" and "Next" alone force the
 * reader to click to find out where they go, and on documentation that is the
 * difference between reading on and stopping.
 *
 * The direction is carried by POSITION and by an arrow, and the label is the
 * title — so the two links are told apart by content rather than by which side
 * of the row they are on, which is what a screen reader gets.
 *
 * A missing neighbour leaves an EMPTY SLOT rather than collapsing, so "next"
 * stays on the right at the end of a series instead of sliding across to where
 * "previous" was.
 *
 * It is `<nav>` with an accessible name, because a page usually has several
 * navigations and an unnamed one is announced as "navigation" among the others.
 */
export function SectionNav({ prev, next, label = "Section", className }: {
  prev?: { href: string; title: React.ReactNode };
  next?: { href: string; title: React.ReactNode };
  label?: string;
  className?: string;
}) {
  const card = "flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg border border-border p-3 hover:bg-muted";
  return (
    <nav aria-label={label} className={cn("flex gap-3", className)}>
      {prev ? (
        <a href={prev.href} className={card}>
          <span className="text-[11px] text-muted-foreground">&larr; Previous</span>
          <span className="truncate text-sm font-medium">{prev.title}</span>
        </a>
      ) : <span className="flex-1" aria-hidden />}
      {next ? (
        <a href={next.href} className={cn(card, "text-right")}>
          <span className="text-[11px] text-muted-foreground">Next &rarr;</span>
          <span className="truncate text-sm font-medium">{next.title}</span>
        </a>
      ) : <span className="flex-1" aria-hidden />}
    </nav>
  );
}
