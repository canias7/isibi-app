import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One number with a label, and optionally how it has moved. */
export function StatCard({
  label, value, hint, trend, className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Positive is not automatically good, so the caller says which way to read it. */
  trend?: { value: string; direction: "up" | "down" | "flat"; good?: boolean };
  className?: string;
}) {
  const good = trend ? (trend.good ?? trend.direction === "up") : null;
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-1 pt-6">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
        <span className="flex items-center gap-2 text-xs">
          {trend && (
            <span className={cn("tabular-nums font-medium", good ? "text-foreground" : "text-muted-foreground")}>
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} {trend.value}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </span>
      </CardContent>
    </Card>
  );
}
