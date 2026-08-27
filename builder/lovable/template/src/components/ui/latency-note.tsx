import { cn } from "@/lib/utils";
/**
 * How slow something is, reported as a percentile rather than an average.
 *
 * THE AVERAGE HIDES THE PROBLEM AND THIS IS THE COMPONENT THAT SAYS SO. A mean
 * of 200ms with a 95th percentile of four seconds means one request in twenty
 * is unbearable — and the average alone reads as healthy. The slow tail is what
 * people experience and complain about.
 *
 * A NUMBER OF USERS, NOT A PERCENTAGE. "5% of requests" is abstract; "one visit
 * in twenty waits over 4 seconds" is a sentence somebody acts on, and the
 * conversion is arithmetic nobody does in their head.
 *
 * IT COMPARES AGAINST A STATED TARGET rather than colouring a number.
 * Acceptable latency depends entirely on what is being done — a search and a
 * report have different budgets — so the target is the caller's and the
 * judgement follows from it.
 *
 * MILLISECONDS BELOW A SECOND, SECONDS ABOVE. "4200 ms" makes somebody divide;
 * "4.2 s" is the unit at which slowness is felt.
 */
function fmt(ms: number) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function LatencyNote({ median, p95, target, what = "requests", className }: {
  /** Typical time, in ms. */
  median?: number;
  /** 95th percentile, in ms. */
  p95?: number;
  /** Budget, in ms. */
  target?: number;
  what?: string;
  className?: string;
}) {
  const over = target !== undefined && p95 !== undefined && p95 > target;
  return (
    <div data-slot="latency-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {median !== undefined && (
          <><span className="tabular-nums">{fmt(median)}</span><span className="text-muted-foreground"> typically</span></>
        )}
        {median !== undefined && p95 !== undefined && <span className="text-muted-foreground"> · </span>}
        {p95 !== undefined && (
          <>
            <span className={cn("tabular-nums", over && "font-medium")}>{fmt(p95)}</span>
            <span className="text-muted-foreground"> for the slowest 1 in 20</span>
          </>
        )}
      </p>
      {target !== undefined && (
        <p className="text-xs text-muted-foreground">
          {over
            ? <>One {what.replace(/s$/, "")} in twenty waits longer than the <span className="text-foreground">{fmt(target)}</span> you aim for.</>
            : <>Inside the {fmt(target)} you aim for.</>}
        </p>
      )}
    </div>
  );
}
