import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The steps of a multi-step flow, with the finished ones clickable.
 *
 * GOING BACK IS ALLOWED, GOING FORWARD IS NOT. Every wizard needs somebody to
 * revisit step 2 from step 4 — checking what they typed is the commonest reason
 * anybody looks at this bar — while jumping ahead to a step whose prerequisites
 * are unmet lands on a form that cannot be submitted. Completed steps are
 * buttons; future ones are text.
 *
 * "STEP 3 OF 6" IS PRINTED AS WORDS as well as drawn, because the shape of a
 * progress bar tells somebody how far along they are and not how much is left
 * in units they can plan around.
 *
 * DONE IS A TICK PLUS `sr-only` TEXT, current is stated in words. A bar where
 * state is only position and fill is unreadable in greyscale and silent to a
 * screen reader.
 *
 * `<ol>` with `aria-current="step"` — the standard the assistive-tech stack
 * actually understands, unlike a row of styled divs.
 */
export function WizardNav({ steps, current, onGo, className }: {
  steps: { id: string; label: string }[];
  /** Zero-based index of the step being shown. */
  current: number;
  /** Omit to make the whole bar non-interactive. */
  onGo?: (index: number) => void;
  className?: string;
}) {
  return (
    <nav data-slot="wizard-nav" className={cn("space-y-1.5", className)} aria-label="Progress">
      <p className="text-xs text-muted-foreground">
        Step <span className="tabular-nums">{Math.min(current + 1, steps.length)}</span> of{" "}
        <span className="tabular-nums">{steps.length}</span>
      </p>
      <ol className="flex flex-wrap gap-x-1 gap-y-1.5">
        {steps.map((s, i) => {
          const done = i < current;
          const now = i === current;
          const inner = (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true"
                className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums",
                  done || now ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground")}>
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn("text-xs", now ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
              {done && <span className="sr-only">, done</span>}
              {now && <span className="sr-only">, current step</span>}
            </span>
          );
          return (
            <li key={s.id} {...(now ? { "aria-current": "step" as const } : {})}
              className="flex items-center gap-1">
              {done && onGo
                ? <button type="button" onClick={() => onGo(i)} className="rounded px-1 py-0.5 hover:bg-muted">{inner}</button>
                : <span className="px-1 py-0.5">{inner}</span>}
              {i < steps.length - 1 && <span aria-hidden="true" className="text-muted-foreground">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
