import { cn } from "@/lib/utils";

export type Stat = { value: string | number; label: string };

/** A row of big numbers. Tabular figures so they line up under each other. */
export function StatsBand({ items, columns, className }: {
  items: Stat[];
  /**
   * How many across. Defaults to one per stat up to four — which is what this
   * rendered before it took the prop, and is an INLINE grid-template rather
   * than a breakpoint, so it never collapsed at any width. Four stats in a
   * 500px rail were 122px each; measured, on two real pages.
   */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const across = Math.min(columns ?? items.length, 4);
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", className)}
      style={{ gridTemplateColumns: `repeat(${across}, minmax(0, 1fr))` }}>
      {items.map((s, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-1 bg-card p-6">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{s.value}</span>
          <span className="text-sm text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
