import { cn } from "@/lib/utils";
/**
 * Where something is in a process that has a known end.
 *
 * DIFFERENT FROM `stepper`, which is a flow the reader is completing right now.
 * This is a record moving through stages other people advance — a repair, an
 * application, an order — so nothing here is clickable, and the current stage is
 * a fact rather than a position.
 *
 * A STAGE THAT WENT WRONG IS SHOWN IN PLACE, not as a separate error. Cancelled
 * and rejected happen AT a stage, and rendering them as a banner above an
 * apparently-still-running bar is how somebody misses that the thing has
 * stopped.
 *
 * A real `<ol>` with `aria-current="step"`, so the position is structural rather
 * than carried by fill alone — the bar is aria-hidden decoration over it.
 */
export type Stage = { key: string; label: string };

export function LifecycleBar({ stages, current, stopped, className }: {
  stages: Stage[];
  /** Key of the stage it has reached. */
  current: string;
  /** Set when it ended early at that stage — "Cancelled". */
  stopped?: string;
  className?: string;
}) {
  if (!stages.length) return null;
  const at = Math.max(stages.findIndex((s) => s.key === current), 0);
  return (
    <ol className={cn("flex flex-wrap gap-x-1 gap-y-2", className)}>
      {stages.map((s, i) => {
        const done = i < at, now = i === at;
        return (
          <li key={s.key} aria-current={now ? "step" : undefined} className="flex min-w-24 flex-1 flex-col gap-1">
            <span aria-hidden className={cn("h-1 rounded-full",
              stopped && now ? "bg-foreground/40" : done || now ? "bg-foreground" : "bg-muted")} />
            <span className={cn("text-xs", now ? "font-medium" : "text-muted-foreground")}>
              {s.label}
              {now && stopped && <span className="block font-medium">{stopped}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
