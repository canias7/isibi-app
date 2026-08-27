import { cn } from "@/lib/utils";
/**
 * You, against everyone else doing the same thing.
 *
 * THE COMPARISON GROUP IS NAMED. "Above average" is meaningless without knowing
 * average of what — all customers, your region, businesses your size — and an
 * unnamed benchmark is the single easiest way to mislead with a true number.
 *
 * The reader's own value is marked with a label, not just a colour, and the
 * benchmark with a dashed line, so both survive greyscale.
 *
 * `sampleSize` is shown when given: "average of 12" and "average of 12,000" are
 * very different claims, and hiding the count is how a benchmark built from a
 * handful of records gets treated as fact.
 */
export function BenchmarkBar({ you, benchmark, max, label, group, sampleSize, unit, className }: {
  you: number; benchmark: number; max?: number;
  label?: string;
  /** Who the benchmark is over — "salons in your region". Required to be honest. */
  group: string;
  sampleSize?: number; unit?: string;
  className?: string;
}) {
  const top = max ?? Math.max(you, benchmark) * 1.15;
  if (top <= 0) return null;
  const pos = (n: number) => `${Math.min((n / top) * 100, 100)}%`;
  return (
    <div data-slot="benchmark-bar" className={cn("flex flex-col gap-1.5", className)}>
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <div aria-hidden className="relative h-6 rounded bg-muted">
        <div className="h-full rounded bg-foreground" style={{ width: pos(you) }} />
        <div className="absolute inset-y-0 border-s-2 border-dashed border-foreground"
          style={{ left: pos(benchmark) }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        You {you.toLocaleString()}{unit ?? ""} · {group} average {benchmark.toLocaleString()}{unit ?? ""}
        {typeof sampleSize === "number" ? ` (from ${sampleSize.toLocaleString()})` : ""}
      </p>
    </div>
  );
}
