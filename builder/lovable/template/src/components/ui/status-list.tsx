import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
/**
 * Every component of a service, with the headline computed from them.
 *
 * The headline is derived rather than passed in: a status page whose banner
 * says "All systems operational" over a list containing an outage is the
 * failure this component exists to make impossible.
 */
export function StatusList({ items, className }: {
  items: { name: string; state: "on" | "pending" | "off" | "error"; note?: string }[];
  className?: string;
}) {
  const worst = items.some((i) => i.state === "error") ? "error"
    : items.some((i) => i.state === "off") ? "off"
    : items.some((i) => i.state === "pending") ? "pending" : "on";
  const headline = { on: "All systems operational", pending: "Degraded performance", off: "Partial outage", error: "Major outage" }[worst];
  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <StatusDot state={worst} showLabel={false} />
        <p className="text-sm font-medium">{headline}</p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0">
              {it.name}
              {it.note && <span className="ms-2 text-xs text-muted-foreground">{it.note}</span>}
            </span>
            <StatusDot state={it.state} />
          </li>
        ))}
      </ul>
    </div>
  );
}
