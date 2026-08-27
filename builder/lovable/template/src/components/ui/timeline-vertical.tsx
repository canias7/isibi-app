import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Events down a rule, newest or oldest first.
 *
 * An `<ol>`, because the ORDER is the content — a timeline in an unordered
 * list tells a screen reader these things happened in no particular sequence,
 * which is the one thing a timeline exists to say.
 *
 * The connector stops at the LAST item rather than running past it, which is
 * the small thing that makes a timeline look finished instead of truncated.
 */
export function TimelineVertical({ items, className }: {
  items: { id: string | number; title: React.ReactNode; meta?: React.ReactNode;
    body?: React.ReactNode; marker?: React.ReactNode; muted?: boolean }[];
  className?: string;
}) {
  return (
    <ol data-slot="timeline-vertical" className={cn("relative", className)}>
      {items.map((it, i) => (
        <li key={it.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < items.length - 1 && (
            <span className="absolute start-[0.6875rem] top-6 h-full w-px bg-border" aria-hidden="true" />
          )}
          <span className={cn("relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background",
            it.muted ? "border-border text-muted-foreground" : "border-foreground")}>
            {it.marker ?? <span className="size-1.5 rounded-full bg-current" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={cn("text-sm font-medium", it.muted && "text-muted-foreground")}>{it.title}</span>
              {it.meta && <span className="text-xs text-muted-foreground">{it.meta}</span>}
            </div>
            {it.body && <div className="mt-1 text-sm text-muted-foreground">{it.body}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
