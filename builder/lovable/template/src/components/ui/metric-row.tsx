import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
/** The row of numbers across the top of a dashboard. */
export function MetricRow({ items, className }: {
  items: { label: string; value: string | number; hint?: string;
           trend?: { value: string; direction: "up" | "down" | "flat"; good?: boolean } }[];
  className?: string;
}) {
  return (
    <div data-slot="metric-row" className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((m) => <StatCard key={m.label} {...m} />)}
    </div>
  );
}
