import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Progress through a multi-step flow.
 *
 * Distinct from `steps`, which describes a process on a marketing page. This one
 * has a CURRENT position and announces it.
 */
export function Stepper({ steps, current, className }: {
  steps: string[]; current: number; className?: string;
}) {
  return (
    <ol className={cn("flex items-center gap-2", className)}
      aria-label={`Step ${current + 1} of ${steps.length}`}>
      {steps.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          <li key={s} className="flex min-w-0 flex-1 items-center gap-2">
            <span aria-current={now ? "step" : undefined}
              className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs tabular-nums",
                done && "border-foreground bg-foreground text-background",
                now && "border-foreground font-medium")}>
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("truncate text-sm", now ? "font-medium" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
