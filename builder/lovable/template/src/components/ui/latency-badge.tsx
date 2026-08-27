import { cn } from "@/lib/utils";
/**
 * A response time with a judgement attached.
 *
 * The thresholds are props with defaults, because "slow" is 300ms for a
 * keystroke and 3s for a report, and a badge with the numbers baked in is
 * wrong on one of those two screens.
 */
export function LatencyBadge({ ms, ok = 300, slow = 1000, className }: {
  ms: number; ok?: number; slow?: number; className?: string;
}) {
  const band = ms <= ok ? "ok" : ms <= slow ? "fair" : "slow";
  const tone = { ok: "text-success", fair: "text-warning", slow: "text-destructive" }[band];
  const word = { ok: "fast", fair: "fair", slow: "slow" }[band];
  const text = ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`;
  return (
    <span data-slot="latency-badge" className={cn("inline-flex items-baseline gap-1 text-xs tabular-nums", tone, className)}>
      {text}<span className="sr-only"> — {word}</span>
    </span>
  );
}
