import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The small line ABOVE a headline — a category, not a second headline.
 *
 * ONE LINE, TRUNCATED. A kicker that wraps has stolen the headline's job;
 * the discipline of the pattern is that it answers "what kind of thing is
 * this" in a word or three ("Opening hours", "From the chair") and gets
 * out of the way. Uppercase with tracking — the kit's established label
 * voice — and muted, so the headline keeps the ink.
 *
 * Optionally a LINK (to the category page): the whole kicker is the
 * anchor, because a 10px uppercase word is already a small target and
 * splitting it smaller helps nobody.
 *
 * Renders BEFORE the heading it labels, in source as on screen, so screen
 * readers meet the category first — same order sighted scanning uses.
 */
export function Kicker({ href, children, className }: {
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const base = "block max-w-full truncate text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground";
  if (href) {
    return <a data-slot="kicker" href={href} className={cn(base, "cursor-pointer hover:text-foreground hover:underline", className)}>{children}</a>;
  }
  return <span className={cn(base, className)}>{children}</span>;
}
