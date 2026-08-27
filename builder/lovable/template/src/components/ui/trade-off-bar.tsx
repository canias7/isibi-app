import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A slider between two things that genuinely trade against each other —
 * cheaper against faster, thorough against quick.
 *
 * BOTH ENDS ARE LABELLED and neither is "good". The whole point of a trade-off
 * is that there is no right answer, and a control with a low end and a high end
 * implies one. So the two extremes are named, and the middle is not marked as
 * the default virtue.
 *
 * IT STATES THE CONSEQUENCE OF THE CURRENT POSITION in a sentence. A slider at
 * 70% with no explanation is a number somebody is guessing about; "About 3 days,
 * around £180" is the thing they are actually choosing.
 *
 * A real `role="slider"` with arrow keys and `aria-valuetext` set to the
 * consequence rather than the number — "mostly faster, about 3 days" is what a
 * listener needs, not "70".
 *
 * Values are DISCRETE steps by default. A continuous slider on a trade-off
 * suggests a precision that the underlying decision does not have.
 */
export function TradeOffBar({ steps, value, onChange, leftLabel, rightLabel, label, className }: {
  steps: { key: string; consequence: React.ReactNode }[];
  value: number;
  onChange: (index: number) => void;
  leftLabel: React.ReactNode;
  rightLabel: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const at = Math.max(0, Math.min(steps.length - 1, value));
  const step = steps[at];

  return (
    <div data-slot="trade-off-bar" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        {/* Neither end is the good end. */}
        <span className="font-medium">{leftLabel}</span>
        <span className="font-medium">{rightLabel}</span>
      </div>
      <div
        role="slider"
        aria-label={label ?? "Trade-off"}
        aria-valuemin={0}
        aria-valuemax={steps.length - 1}
        aria-valuenow={at}
        aria-valuetext={typeof step?.consequence === "string" ? step.consequence : step?.key}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(steps.length - 1, at + 1)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(0, at - 1)); }
          if (e.key === "Home") { e.preventDefault(); onChange(0); }
          if (e.key === "End") { e.preventDefault(); onChange(steps.length - 1); }
        }}
        className="flex items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {steps.map((s, i) => (
          <button key={s.key} type="button" tabIndex={-1} onClick={() => onChange(i)}
            aria-label={`Step ${i + 1} of ${steps.length}`}
            className={cn("h-2 flex-1 cursor-pointer rounded-full",
              i === at ? "bg-foreground" : "bg-muted hover:bg-muted-foreground/40")} />
        ))}
      </div>
      <p aria-live="polite" className="text-sm">{step?.consequence}</p>
    </div>
  );
}
