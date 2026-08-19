import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A process along a line — order placed, packed, shipped, delivered.
 *
 * It SCROLLS rather than squashing. Five stages forced into 375px gives five
 * unreadable labels, and the usual fix — hiding the labels on small screens —
 * leaves a row of dots that means nothing.
 *
 * The completed portion is drawn as a separate filled rule rather than by
 * colouring each segment, so the progress reads as one continuous distance
 * instead of a set of independent ticks.
 */
export function TimelineHorizontal({ steps, current = 0, className }: {
  steps: { label: string; meta?: string }[]; current?: number; className?: string;
}) {
  const pct = steps.length > 1 ? (Math.min(current, steps.length - 1) / (steps.length - 1)) * 100 : 0;
  return (
    <div className={cn("overflow-x-auto pb-2", className)}>
      <ol className="relative flex min-w-max gap-12 px-3 pt-4">
        <span className="absolute start-3 end-3 top-[1.4375rem] h-px bg-border" aria-hidden="true" />
        <span className="absolute start-3 top-[1.4375rem] h-px bg-foreground" aria-hidden="true"
          style={{ width: `calc((100% - 1.5rem) * ${pct / 100})` }} />
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex w-28 flex-col items-center text-center">
            <span className={cn("z-10 mb-2 size-3 rounded-full ring-4 ring-background",
              i <= current ? "bg-foreground" : "bg-border")} />
            <span className={cn("text-xs", i <= current ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {s.meta && <span className="mt-0.5 text-[10px] text-muted-foreground">{s.meta}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
