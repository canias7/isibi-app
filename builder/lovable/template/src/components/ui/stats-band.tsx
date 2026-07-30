import { cn } from "@/lib/utils";

export type Stat = { value: string | number; label: string };

/** A row of big numbers. Tabular figures so they line up under each other. */
export function StatsBand({ items, className }: { items: Stat[]; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", className)}
      style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map((s, i) => (
        <div key={i} className="flex flex-col gap-1 bg-card p-6">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{s.value}</span>
          <span className="text-sm text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
