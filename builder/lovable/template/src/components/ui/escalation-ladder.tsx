import { cn } from "@/lib/utils";
/**
 * Who gets told next, and when.
 *
 * THE WHOLE LADDER IS VISIBLE FROM THE START. An escalation policy revealed one
 * step at a time is one nobody can plan against — and the person at the top
 * usually wants to know they are on it before they are woken up.
 *
 * THE CURRENT RUNG IS MARKED and the ones already passed are struck through, so
 * the history and the future read from the same list rather than needing a
 * separate log.
 *
 * A real `<ol>` with `aria-current`, since the order is the meaning and a screen
 * reader should get "3 of 4" for free.
 */
export function EscalationLadder({ rungs, currentIndex, className }: {
  rungs: { who: string; after: string }[];
  /** Zero-based; -1 before it starts. */
  currentIndex: number;
  className?: string;
}) {
  if (!rungs.length) return null;
  return (
    <ol className={cn("flex flex-col gap-1 text-sm", className)}>
      {rungs.map((r, i) => {
        const past = i < currentIndex, now = i === currentIndex;
        return (
          <li key={i} aria-current={now ? "step" : undefined}
            className={cn("flex flex-wrap items-baseline gap-x-2",
              past && "text-muted-foreground line-through", now && "font-medium")}>
            {past && <span className="sr-only">Already notified: </span>}
            <span>{r.who}</span>
            <span className={cn("text-xs", !now && "text-muted-foreground")}>{r.after}</span>
          </li>
        );
      })}
    </ol>
  );
}
