import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The numbered rail beside a long form.
 *
 * A completed step is a LINK back and a future step is not — letting somebody
 * jump to step 4 before step 2 exists produces a form that validates in an
 * order nobody designed. `aria-current` marks where they are.
 */
export function FormProgress({ steps, current, onGoTo, className }: {
  steps: string[]; current: number; onGoTo?: (i: number) => void; className?: string;
}) {
  return (
    <ol className={cn("space-y-1", className)}>
      {steps.map((s, i) => {
        const done = i < current, here = i === current;
        const inner = (
          <>
            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
              done ? "border-transparent bg-foreground text-background"
                : here ? "border-foreground font-medium" : "border-border text-muted-foreground")}>
              {done ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={cn("text-sm", here ? "font-medium" : !done && "text-muted-foreground")}>{s}</span>
          </>
        );
        const cls = "flex w-full items-center gap-2.5 rounded px-1 py-1.5 text-start";
        return (
          <li key={s} aria-current={here ? "step" : undefined}>
            {done && onGoTo
              ? <button type="button" onClick={() => onGoTo(i)} className={cn(cls, "cursor-pointer hover:bg-muted")}>{inner}</button>
              : <div className={cls}>{inner}</div>}
          </li>
        );
      })}
    </ol>
  );
}
