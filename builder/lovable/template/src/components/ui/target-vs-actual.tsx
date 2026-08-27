import { cn } from "@/lib/utils";
/**
 * Where you are against where you said you would be.
 *
 * THE TARGET IS A LINE ON THE BAR, not a second bar. Two bars side by side make
 * the reader compare lengths; a marker on the one bar makes over and under
 * immediately obvious, which is the only question this answers.
 *
 * Over target is stated in WORDS as well as position — "12% over" — because a
 * bar that runs past a line is invisible in a small chart, in greyscale, and to
 * a screen reader. The bar is aria-hidden and the sentence carries the meaning.
 *
 * `goodDirection` exists because up is not always good. For cancellations,
 * complaints or cost, beating the target is bad, and a component that assumes
 * otherwise congratulates people on the wrong things.
 */
export function TargetVsActual({ actual, target, label, unit, goodDirection = "up", className }: {
  actual: number; target: number; label?: string; unit?: string;
  goodDirection?: "up" | "down";
  className?: string;
}) {
  if (target <= 0) return null;
  const pct = Math.round((actual / target) * 100);
  const over = actual > target;
  const good = goodDirection === "up" ? over : !over;
  const width = Math.min(pct, 100);
  const markerAt = actual > target ? (target / actual) * 100 : 100;
  return (
    <div data-slot="target-vs-actual" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {label && <span className="text-sm text-muted-foreground">{label}</span>}
        <span className="text-sm tabular-nums">
          <span className="font-medium">{actual.toLocaleString()}{unit ?? ""}</span>
          <span className="text-muted-foreground"> of {target.toLocaleString()}{unit ?? ""}</span>
        </span>
      </div>
      <div aria-hidden className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ width: `${width}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-background" style={{ left: `${markerAt}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {pct}% of target — {Math.abs(pct - 100)}% {over ? "over" : "under"}
        {good ? "" : ", short of where it should be"}
      </p>
    </div>
  );
}
